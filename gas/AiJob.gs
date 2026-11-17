/**
 * AiJob.gs — split the upload analysis into resumable stages.
 *
 * Apps Script kills an execution after 6 minutes, so asking one request to run
 * facts + narrative + summary is fragile: on a slow day the request dies and
 * every finished section is lost. Each entry point below runs a single stage
 * and stores the state in CacheService, so every stage gets a fresh execution
 * budget and a failed stage no longer throws away the earlier ones.
 *
 * Flow used by the web app:
 *   startAiAnalysisJob(payload)  -> runs the facts stage, returns a jobId
 *   stepAiAnalysisJob(jobId)     -> runs narrative, then summary (one per call)
 */

var AI_JOB_TTL_SECONDS_ = 21600;      // CacheService maximum (6 hours)
var AI_JOB_CHUNK_CHARS_ = 25000;      // Thai text is up to 3 bytes per char in UTF-8
var AI_JOB_SUMMARY_STAGES_ = ['orgAnalysis4M', 'businessAnalysis', 'welfareAnalysis'];

function aiJobKey_(jobId, suffix) {
  return 'aijob_' + jobId + '_' + suffix;
}

/** Store the job state as several cache entries because one value is capped at 100KB. */
function saveAiJob_(jobId, state) {
  const cache = CacheService.getScriptCache();
  const json = JSON.stringify(state);
  const count = Math.max(1, Math.ceil(json.length / AI_JOB_CHUNK_CHARS_));
  const values = {};
  for (let i = 0; i < count; i++) {
    values[aiJobKey_(jobId, 'c' + i)] = json.slice(i * AI_JOB_CHUNK_CHARS_, (i + 1) * AI_JOB_CHUNK_CHARS_);
  }
  cache.putAll(values, AI_JOB_TTL_SECONDS_);
  cache.put(aiJobKey_(jobId, 'meta'), JSON.stringify({
    chunks: count,
    status: state.status,
    stage: state.stage,
    updatedAt: new Date().toISOString()
  }), AI_JOB_TTL_SECONDS_);
}

/** Load a job state, or null when it is missing/expired/corrupted. */
function loadAiJob_(jobId) {
  const cache = CacheService.getScriptCache();
  const metaText = cache.get(aiJobKey_(jobId, 'meta'));
  if (!metaText) return null;

  let meta;
  try {
    meta = JSON.parse(metaText);
  } catch (e) {
    return null;
  }

  const keys = [];
  for (let i = 0; i < (meta.chunks || 0); i++) keys.push(aiJobKey_(jobId, 'c' + i));
  const values = cache.getAll(keys);
  let json = '';
  for (let k = 0; k < keys.length; k++) {
    if (!values[keys[k]]) return null;
    json += values[keys[k]];
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function dropAiJob_(jobId) {
  const cache = CacheService.getScriptCache();
  let count = 1;
  const metaText = cache.get(aiJobKey_(jobId, 'meta'));
  if (metaText) {
    try {
      count = JSON.parse(metaText).chunks || 1;
    } catch (e) {}
  }
  const keys = [aiJobKey_(jobId, 'meta')];
  for (let i = 0; i < count; i++) keys.push(aiJobKey_(jobId, 'c' + i));
  cache.removeAll(keys);
}

/**
 * Keep only what the narrative/summary stages need.
 * Scanned files travel as base64 only for the facts stage; those stages use the
 * extracted text, so the attachments are dropped before the state is cached.
 */
function aiJobInput_(payload) {
  const files = (payload.files || []).map(function (file) {
    return {
      name: file && file.name,
      category: file && file.category,
      extractedText: file && file.extractedText,
      evidenceText: file && file.evidenceText
    };
  });
  return {
    coopName: payload.coopName,
    coopCategoryName: payload.coopCategoryName,
    dbFiscalYear: payload.dbFiscalYear,
    weaknesses: payload.weaknesses || [],
    score68: payload.score68 || {},
    score69: payload.score69 || {},
    plannedVisits: payload.plannedVisits,
    files: files
  };
}

/** Merge the warnings/models/trace of one stage into the job state. */
function aiJobCollect_(state, run) {
  const warnings = (run && run._aiWarnings) || [];
  warnings.forEach(function (w) {
    if (state.warnings.indexOf(w) === -1) state.warnings.push(w);
  });
  const models = (run && run._aiModels) || [];
  models.forEach(function (m) {
    if (state.models.indexOf(m) === -1) state.models.push(m);
  });
  state.trace = (state.trace || []).concat((run && run._aiTrace) || []);
}

/** Attach the metadata the UI already understands and mark the job finished. */
function aiJobFinish_(state) {
  state.result = state.result || {};
  if (state.warnings.length) state.result._aiWarnings = state.warnings.slice();
  state.result._aiModels = state.models.slice();
  state.result._aiTrace = state.trace.slice();
  state.status = 'done';
  state.stage = 'done';
}

function aiJobSnapshot_(state) {
  const snapshot = {
    jobId: state.jobId,
    status: state.status,
    stage: state.stage,
    warnings: (state.warnings || []).slice()
  };
  if (state.status === 'done') {
    snapshot.result = state.result || {};
  } else {
    snapshot.filled = state.result ? Object.keys(state.result).length : 0;
  }
  return snapshot;
}

/**
 * Run the facts stage now (the payload still carries the attachments) and cache
 * the remaining work for stepAiAnalysisJob().
 */
function startAiAnalysisJob(payload) {
  if (!payload || typeof payload !== 'object') {
    throw apiError_('BAD_REQUEST', 'ต้องส่งข้อมูลสำหรับวิเคราะห์');
  }

  const jobId = String(Utilities.getUuid ? Utilities.getUuid() : Date.now())
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20);

  const factsRun = analyzeUploadedFilesWithAI(payload, { stage: 'facts' });
  const facts = factsRun.facts || {};

  const state = {
    jobId: jobId,
    status: 'running',
    stage: 'narrative',
    createdAt: new Date().toISOString(),
    input: aiJobInput_(payload),
    prior: {
      facts: facts,
      fieldSources: factsRun.fieldSources || null,
      fieldConflicts: factsRun.fieldConflicts || null,
      chunkCount: factsRun.chunkCount || 0
    },
    result: facts,
    warnings: [],
    models: [],
    trace: []
  };
  aiJobCollect_(state, factsRun);
  if (factsRun.fieldSources && Object.keys(factsRun.fieldSources).length) {
    state.result._aiFieldSources = factsRun.fieldSources;
  }
  if (factsRun.fieldConflicts && Object.keys(factsRun.fieldConflicts).length) {
    state.result._aiConflicts = factsRun.fieldConflicts;
  }
  if (factsRun.chunkCount) state.result._aiChunks = factsRun.chunkCount;

  saveAiJob_(jobId, state);
  logAiStage_('job-started', { jobId: jobId, filled: Object.keys(facts).length });
  return aiJobSnapshot_(state);
}

/** Advance the job by one stage. Safe to call repeatedly (LockService guards overlap). */
function stepAiAnalysisJob(jobId) {
  if (!jobId) throw apiError_('BAD_REQUEST', 'ต้องระบุ jobId');

  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(2000);
  if (!locked) return { jobId: jobId, status: 'busy', stage: '' };

  try {
    const state = loadAiJob_(jobId);
    if (!state) {
      throw apiError_('JOB_NOT_FOUND', 'ไม่พบงานวิเคราะห์ (อาจหมดอายุ) กรุณากดประมวลผลอีกครั้ง');
    }
    if (state.status === 'done') return aiJobSnapshot_(state);

    if (state.stage === 'narrative') {
      try {
        const narrative = analyzeUploadedFilesWithAI(state.input, { stage: 'narrative', prior: state.prior });
        const sections = (narrative && narrative.sections) || {};
        state.prior.sections = sections;
        AI_JOB_SUMMARY_STAGES_.forEach(function (key) {
          if (sections[key]) state.result[key] = sections[key];
        });
        aiJobCollect_(state, narrative);
      } catch (e) {
        state.warnings.push('บทวิเคราะห์หัวข้อ 1-3 ไม่สำเร็จ: ' + e.message);
      }
      state.stage = 'summary';
    } else if (state.stage === 'summary') {
      try {
        const summary = analyzeUploadedFilesWithAI(state.input, { stage: 'summary', prior: state.prior });
        if (summary && typeof summary === 'object') state.result = summary;
        aiJobCollect_(state, summary);
      } catch (e) {
        state.warnings.push('บทวิเคราะห์หัวข้อ 4 ไม่สำเร็จ: ' + e.message);
      }
      aiJobFinish_(state);
    } else {
      aiJobFinish_(state);
    }

    saveAiJob_(jobId, state);
    logAiStage_('job-step', { jobId: jobId, stage: state.stage, warnings: state.warnings.length });
    return aiJobSnapshot_(state);
  } finally {
    if (locked) lock.releaseLock();
  }
}
