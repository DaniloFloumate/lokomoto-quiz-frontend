// ============================================
// STATE MANAGER
// Drži stanje kviza (odgovori, trenutni step, sessionId)
// ============================================

const State = (function() {

  // Glavni state objekat
  const state = {
    sessionId: null,
    currentScreen: null,
    screenHistory: [],
    screenStartTime: null,

    answers: {
      gender: null,                  // 'male' | 'female'
      pain_location: null,           // 'neck' | 'middle' | 'lower'
      pain_radiates: null,           // true | false
      diagnosis: null,               // 'muscle' | 'hernia'

      pain_frequency: null,          // { value: 'A', text: '...' }
      pain_description: null,
      pain_when: null,
      pain_trigger: null,
      what_helps: null,
      daily_impact: null,
      what_worsens: null,
      accompanying_feeling: null,
      previous_attempts: null,

      pain_scale: null,              // 1-10
      pain_duration: null,           // string

      goals: [],                     // multi-select array

      name: null,
      email: null,
    },
  };


  // ============================================
  // PUBLIC API
  // ============================================

  function getSessionId() {
    return state.sessionId;
  }

  function setSessionId(id) {
    state.sessionId = id;
  }

  function getAnswer(key) {
    return state.answers[key];
  }

  function setAnswer(key, value) {
    if (!(key in state.answers)) {
      console.warn(`[state] Pokušaj postavljanja nepoznatog odgovora: ${key}`);
      return;
    }
    state.answers[key] = value;

    // Side effect: ako se postavi pain_radiates, izračunaj diagnosis
    if (key === 'pain_radiates') {
      state.answers.diagnosis = value === true ? 'hernia' : 'muscle';
    }
  }

  function getAllAnswers() {
    return { ...state.answers };
  }

  function getCurrentScreen() {
    return state.currentScreen;
  }

  function setCurrentScreen(screenName, options = {}) {
    // options.skipHistory: true → ne dodaje trenutni u history (kad ide nazad)
    if (state.currentScreen && !options.skipHistory) {
      state.screenHistory.push(state.currentScreen);
    }
    state.currentScreen = screenName;
    state.screenStartTime = Date.now();
}

function getPreviousScreen() {
    return state.screenHistory[state.screenHistory.length - 1] || null;
}

function popScreenHistory() {
    return state.screenHistory.pop() || null;
}

function getScreenHistory() {
    return [...state.screenHistory];
}

  function getTimeOnCurrentScreen() {
    if (!state.screenStartTime) return null;
    return Math.round((Date.now() - state.screenStartTime) / 1000);
  }

  function reset() {
    state.sessionId = null;
    state.currentScreen = null;
    state.screenHistory = [];
    state.screenStartTime = null;
    Object.keys(state.answers).forEach(key => {
      state.answers[key] = Array.isArray(state.answers[key]) ? [] : null;
    });
  }

  // Debug helper
  function dump() {
    console.log('[STATE]', JSON.parse(JSON.stringify(state)));
  }

  // Get UTM params iz URL-a (za tracking)
  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
    };
  }


  return {
    getSessionId,
    setSessionId,
    getAnswer,
    setAnswer,
    getAllAnswers,
    getCurrentScreen,
    setCurrentScreen,
    getPreviousScreen,
    popScreenHistory,
    getScreenHistory,
    getTimeOnCurrentScreen,
    getUtmParams,
    reset,
    dump,
  };

})();

console.log('[state.js] učitan');