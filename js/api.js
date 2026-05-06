// ============================================
// API CLIENT
// Komunikacija sa Lokomoto Quiz backend-om (Railway)
// ============================================

const API = (function() {

  // Production Railway URL
  const BASE_URL = 'https://lokomoto-quiz-api-production.up.railway.app';

  /**
   * Generički wrapper oko fetch-a
   * - Dodaje Content-Type header
   * - Hvata greške
   * - Vraća parsed JSON
   */
  async function request(method, path, body) {
    try {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        opts.body = JSON.stringify(body);
      }

      const response = await fetch(BASE_URL + path, opts);
      const data = await response.json();

      if (!response.ok) {
        console.error(`API error ${response.status}:`, data);
        return { success: false, error: data.error || 'Greška', status: response.status };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Network error:', err);
      return { success: false, error: 'Mrežna greška', networkError: true };
    }
  }


  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Kreira novu kviz sesiju
   * Vraća: { success, data: { session_id }, error }
   */
  async function startSession(meta = {}) {
    return request('POST', '/api/sessions', {
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
      utm_source: meta.utm_source || null,
      utm_medium: meta.utm_medium || null,
      utm_campaign: meta.utm_campaign || null,
      utm_content: meta.utm_content || null,
      utm_term: meta.utm_term || null,
      device_type: getDeviceType(),
    });
  }

  /**
   * Update sesije sa novim podacima
   */
  async function updateSession(sessionId, updates) {
    return request('PATCH', `/api/sessions/${sessionId}`, updates);
  }

  /**
   * Finalizuje sesiju (lead capture)
   */
  async function completeSession(sessionId, leadData) {
    return request('POST', `/api/sessions/${sessionId}/complete`, leadData);
  }

  /**
   * Loguje event (step_viewed, step_completed, itd.)
   */
  async function logEvent(sessionId, eventType, opts = {}) {
    return request('POST', '/api/events', {
      session_id: sessionId,
      event_type: eventType,
      step_number: opts.step_number || null,
      step_name: opts.step_name || null,
      time_on_step: opts.time_on_step || null,
      metadata: opts.metadata || {},
    });
  }


  // ============================================
  // HELPERS
  // ============================================

  function getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
    if (/ipad|tablet/.test(ua)) return 'tablet';
    return 'desktop';
  }


  // Public interface
  return {
    startSession,
    updateSession,
    completeSession,
    logEvent,
  };

})();

console.log('[api.js] učitan, BASE_URL:', 'https://lokomoto-quiz-api-production.up.railway.app');