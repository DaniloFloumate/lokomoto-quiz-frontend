// ============================================
// QUIZ - Glavni kontroler
// Inicijalizacija, screen rendering, navigacija
// ============================================

const Quiz = (function() {

  // DOM reference
  let screensContainer = null;
  let progressBar = null;
  let progressBarFill = null;
  let globalBackBtn = null;

  let currentBackHandler = null;
  let pendingScreenOpts = null;
  let currentSwipeCleanup = null;

  const TOTAL_SCREENS = 21;


  async function init() {
    screensContainer = document.getElementById('quizScreens');
    progressBar = document.getElementById('progressBar');
    progressBarFill = document.getElementById('progressBarFill');
    globalBackBtn = document.getElementById('globalBackBtn');

    if (!screensContainer) {
      console.error('Quiz: ne mogu da nađem #quizScreens element');
      return;
    }

    globalBackBtn.addEventListener('click', () => {
      if (currentBackHandler) {
        currentBackHandler();
      }
    });

    await startSession();
  }


  async function startSession() {
    screensContainer.innerHTML = '<div class="loading">Učitavanje...</div>';

    const utmParams = State.getUtmParams();
    const result = await API.startSession(utmParams);

    if (!result.success) {
      screensContainer.innerHTML = `
        <div class="error-state">
          <h2 class="screen__title">Trenutno imamo poteškoća</h2>
          <p class="screen__subtitle">Pokušaj da osvežiš stranicu za par sekundi.</p>
          <button class="btn btn--primary" onclick="location.reload()">OSVEŽI STRANICU</button>
        </div>
      `;
      console.error('startSession failed:', result);
      return;
    }

    State.setSessionId(result.data.session_id);
    console.log('[quiz] Sesija kreirana:', result.data.session_id);

    showGender();
  }


  function setScreen(html, screenName, screenNumber = null, opts = {}) {
    if (screenName !== 'edu_block' && currentSwipeCleanup) {
      currentSwipeCleanup();
      currentSwipeCleanup = null;
    }

    if (screenName !== 'edu_block') {
      document.body.className = '';
    }

    if (pendingScreenOpts) {
      opts = { ...opts, ...pendingScreenOpts };
    }

    State.setCurrentScreen(screenName, { skipHistory: opts.isBackNavigation });

    screensContainer.innerHTML = `
      <div class="screen" data-screen="${screenName}">
        ${html}
      </div>
    `;

    const isFullscreenScreen = screenName === 'edu_block';

    if (isFullscreenScreen) {
      progressBar.classList.add('hidden');
    } else if (screenNumber !== null) {
      const progress = (screenNumber / TOTAL_SCREENS) * 100;
      progressBarFill.style.width = `${progress}%`;
      progressBar.classList.remove('hidden');
    } else {
      progressBar.classList.add('hidden');
    }

    const isFirstScreen = State.getPreviousScreen() === null;
    const shouldHideBack = opts.hideBack || isFirstScreen || isFullscreenScreen;

    if (shouldHideBack) {
      globalBackBtn.classList.add('hidden');
      currentBackHandler = null;
    } else {
      globalBackBtn.classList.remove('hidden');
      currentBackHandler = opts.backHandler || (() => goBack());
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (screenNumber !== null) {
      API.logEvent(State.getSessionId(), 'step_viewed', {
        step_number: screenNumber,
        step_name: screenName,
      });
    }
  }


  function goBack() {
    const targetScreen = State.popScreenHistory();

    if (!targetScreen) {
      console.warn('Nema prethodnog screen-a u history-ju');
      return;
    }

    showScreenByName(targetScreen, { isBackNavigation: true });
  }


  function showScreenByName(screenName, opts = {}) {
    pendingScreenOpts = opts;

    const map = {
      gender: showGender,
      pain_location: showPainLocation,
      pain_location_conclusion: () => showPainLocationConclusion(State.getAnswer('pain_location')),
      pain_radiates: showPainRadiates,
      pain_frequency: () => showAbcQuestion('pain_frequency', 5),
      pain_description: () => showAbcQuestion('pain_description', 6),
      pain_scale: showPainScale,
      pain_duration: showPainDuration,
      mid_conclusion: showMidConclusion,
      pain_when: () => showAbcQuestion('pain_when', 10),
      pain_trigger: () => showAbcQuestion('pain_trigger', 11),
      what_helps: () => showAbcQuestion('what_helps', 12),
      daily_impact: () => showAbcQuestion('daily_impact', 13),
      what_worsens: () => showAbcQuestion('what_worsens', 14),
      accompanying_feeling: () => showAbcQuestion('accompanying_feeling', 15),
      previous_attempts: () => showAbcQuestion('previous_attempts', 16),
      goals: () => showGoals(),
      edu_block: () => showEduBlock(),
    };

    const fn = map[screenName];
    if (fn) {
      fn();
    } else {
      console.error(`Nepoznat screen: ${screenName}`);
    }

    pendingScreenOpts = null;
  }

  // ============================================
  // SCREEN: GENDER — STEP 1
  // ============================================

  function showGender() {
    const html = `
      <h2 class="screen__title">Izaberi svoj pol</h2>
      <p class="screen__subtitle">Da bismo ti pružili tačnije rezultate.</p>

      <div class="gender-grid">
        <button class="gender-card" data-gender="female">
          <div class="gender-card__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="5"></circle>
              <path d="M12 13v8"></path>
              <path d="M9 18h6"></path>
            </svg>
          </div>
          <div class="gender-card__label">Žensko</div>
        </button>
        <button class="gender-card" data-gender="male">
          <div class="gender-card__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10" cy="14" r="5"></circle>
              <path d="M19 5l-5.5 5.5"></path>
              <path d="M14 5h5v5"></path>
            </svg>
          </div>
          <div class="gender-card__label">Muško</div>
        </button>
      </div>
    `;

    setScreen(html, 'gender', 1);

    document.querySelectorAll('.gender-card').forEach(card => {
      card.addEventListener('click', () => handleGenderSelect(card.dataset.gender));
    });
  }


  function handleGenderSelect(gender) {
    State.setAnswer('gender', gender);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    // Fire-and-forget — ne čekamo API
    API.updateSession(sessionId, {
      gender,
      current_step: 'gender',
      current_step_number: 1,
    });
    API.logEvent(sessionId, 'step_completed', {
      step_number: 1,
      step_name: 'gender',
      time_on_step: timeOnStep,
      metadata: { value: gender },
    });

    showPainLocation();
  }


  // ============================================
  // SCREEN: PAIN LOCATION — STEP 3
  // ============================================

  function showPainLocation() {
    const html = `
      <h2 class="screen__title">Gde osećaš bol?</h2>
      <p class="screen__subtitle">Izaberi gde te najviše boli.</p>

      <div class="options-list">
        <button class="option" data-location="neck">
          <span class="option__indicator"></span>
          <span class="option__text">Vrat</span>
        </button>
        <button class="option" data-location="middle">
          <span class="option__indicator"></span>
          <span class="option__text">Srednji deo leđa</span>
        </button>
        <button class="option" data-location="lower">
          <span class="option__indicator"></span>
          <span class="option__text">Donja leđa</span>
        </button>
      </div>
    `;

    setScreen(html, 'pain_location', 2);

    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.querySelectorAll('.option').forEach(o => o.disabled = true);

        setTimeout(() => {
          handlePainLocationSelect(opt.dataset.location);
        }, 180);
      });
    });
  }


  function handlePainLocationSelect(location) {  // ← NE async više
  State.setAnswer('pain_location', location);

  const timeOnStep = State.getTimeOnCurrentScreen();
  const sessionId = State.getSessionId();

  // Šalji u pozadini — NE await
  API.updateSession(sessionId, {
    pain_location: location,
    current_step: 'pain_location',
    current_step_number: 2,
  });
  API.logEvent(sessionId, 'step_completed', {
    step_number: 2,
    step_name: 'pain_location',
    time_on_step: timeOnStep,
    metadata: { value: location },
  });

  // Idi odmah na sledeći screen — ne čekaj API
  showPainLocationConclusion(location);
}


  // ============================================
  // SCREEN: PAIN LOCATION CONCLUSION — STEP 4
  // ============================================

  function showPainLocationConclusion(location) {
    const conclusions = {
      neck: { percentage: 34, bodyPart: 'vratu' },
      middle: { percentage: 18, bodyPart: 'srednjem delu leđa' },
      lower: { percentage: 48, bodyPart: 'donjim leđima' },
    };

    const conclusion = conclusions[location];

    const icons = {
      neck: `
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M40 10 v60"/>
            <path d="M28 18 h24"/>
            <path d="M25 30 h30"/>
            <path d="M25 42 h30"/>
            <path d="M25 54 h30"/>
            <path d="M28 64 h24"/>
            <path d="M31 72 h18"/>
          </g>
          <circle cx="40" cy="22" r="13" fill="#ef4444" opacity="0.25"/>
          <circle cx="40" cy="22" r="7" fill="#ef4444" opacity="0.6"/>
        </svg>
      `,
      middle: `
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M40 10 v60"/>
            <path d="M28 18 h24"/>
            <path d="M25 30 h30"/>
            <path d="M25 42 h30"/>
            <path d="M25 54 h30"/>
            <path d="M28 64 h24"/>
            <path d="M31 72 h18"/>
          </g>
          <circle cx="40" cy="42" r="13" fill="#ef4444" opacity="0.25"/>
          <circle cx="40" cy="42" r="7" fill="#ef4444" opacity="0.6"/>
        </svg>
      `,
      lower: `
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M40 10 v60"/>
            <path d="M28 18 h24"/>
            <path d="M25 30 h30"/>
            <path d="M25 42 h30"/>
            <path d="M25 54 h30"/>
            <path d="M28 64 h24"/>
            <path d="M31 72 h18"/>
          </g>
          <circle cx="40" cy="62" r="13" fill="#ef4444" opacity="0.25"/>
          <circle cx="40" cy="62" r="7" fill="#ef4444" opacity="0.6"/>
        </svg>
      `,
    };

    const html = `
      <div class="conclusion">
        <div class="conclusion__icon">
          ${icons[location] || icons.middle}
        </div>
        <h2 class="conclusion__title">
          <span class="conclusion__highlight">${conclusion.percentage}%</span> naših klijenata dolazi zbog bola u ${conclusion.bodyPart}.
        </h2>
        <p class="conclusion__text">
          To je problem koji rešavamo svakodnevno.<br><br>
          Hajde da precizno utvrdimo zašto tebe boli, kako bismo ti dali jasan i primenljiv plan.
        </p>

        <div class="actions">
          <button class="btn btn--primary" id="continueBtn">NASTAVI ›</button>
        </div>
      </div>
    `;

    setScreen(html, 'pain_location_conclusion', 3);

    document.getElementById('continueBtn').addEventListener('click', () => {
      setTimeout(() => {
        showPainRadiates();
      }, 180);
    });
  }


  // ============================================
  // SCREEN: PAIN RADIATES — STEP 5
  // CHANGE: opcije su sada samo "Ne" i "Da" (bez dodatnog teksta)
  // ============================================

  function showPainRadiates() {
    const painLocation = State.getAnswer('pain_location');
    const bodyPart = painLocation === 'lower' ? 'nogu' : 'ruku';

    const html = `
      <h2 class="screen__title">Da li ti se bol spušta niz ${bodyPart}?</h2>
      <p class="screen__subtitle">Ovo nam pomaže da preciznije utvrdimo uzrok.</p>

      <div class="options-list">
        <button class="option" data-radiates="false">
          <span class="option__indicator"></span>
          <span class="option__text">Ne</span>
        </button>
        <button class="option" data-radiates="true">
          <span class="option__indicator"></span>
          <span class="option__text">Da</span>
        </button>
      </div>
    `;

    setScreen(html, 'pain_radiates', 4);

    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.querySelectorAll('.option').forEach(o => o.disabled = true);

        setTimeout(() => {
          const radiates = opt.dataset.radiates === 'true';
          handlePainRadiatesSelect(radiates);
        }, 180);
      });
    });
  }


  function handlePainRadiatesSelect(radiates) {
    State.setAnswer('pain_radiates', radiates);
    const diagnosis = State.getAnswer('diagnosis');

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    // Fire-and-forget — ne čekamo API
    API.updateSession(sessionId, {
      pain_radiates: radiates,
      diagnosis,
      current_step: 'pain_radiates',
      current_step_number: 4,
    });
    API.logEvent(sessionId, 'step_completed', {
      step_number: 4,
      step_name: 'pain_radiates',
      time_on_step: timeOnStep,
      metadata: { value: radiates, diagnosis },
    });

    showAbcQuestion('pain_frequency', 6);
  }


  // ============================================
  // UNIVERZALNI A/B/C SCREEN
  // ============================================

  function showAbcQuestion(questionKey, screenNumber) {
    const q = Questions.get(questionKey);
    if (!q) {
      console.error(`Pitanje ${questionKey} ne postoji`);
      return;
    }

    const optionsHtml = q.options.map(opt => `
      <button class="option" data-value="${opt.value}" data-text="${opt.text.replace(/"/g, '&quot;')}">
        <span class="option__indicator"></span>
        <span class="option__text">${opt.text}</span>
      </button>
    `).join('');

    const subtitleHtml = q.subtitle
      ? `<p class="screen__subtitle">${q.subtitle}</p>`
      : '';

    const html = `
      <h2 class="screen__title">${q.title}</h2>
      ${subtitleHtml}
      <div class="options-list">
        ${optionsHtml}
      </div>
    `;

    setScreen(html, questionKey, screenNumber);

    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.querySelectorAll('.option').forEach(o => o.disabled = true);

        setTimeout(() => {
          handleAbcSelect(questionKey, screenNumber, {
            value: opt.dataset.value,
            text: opt.dataset.text,
          });
        }, 180);
      });
    });
  }


  function handleAbcSelect(questionKey, screenNumber, answer) {
    State.setAnswer(questionKey, answer);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    const allAnswers = State.getAllAnswers();
    // Fire-and-forget — ne čekamo API
    API.updateSession(sessionId, {
      answers: {
        pain_frequency: allAnswers.pain_frequency,
        pain_description: allAnswers.pain_description,
        pain_when: allAnswers.pain_when,
        pain_trigger: allAnswers.pain_trigger,
        what_helps: allAnswers.what_helps,
        daily_impact: allAnswers.daily_impact,
        what_worsens: allAnswers.what_worsens,
        accompanying_feeling: allAnswers.accompanying_feeling,
        previous_attempts: allAnswers.previous_attempts,
      },
      current_step: questionKey,
      current_step_number: screenNumber,
    });
    API.logEvent(sessionId, 'step_completed', {
      step_number: screenNumber,
      step_name: questionKey,
      time_on_step: timeOnStep,
      metadata: { value: answer.value },
    });

    routeNextAbc(questionKey);
  }


  function routeNextAbc(currentQuestion) {
    const flow = {
      pain_frequency: () => showAbcQuestion('pain_description', 7),
      pain_description: () => showPainScale(),
      pain_when: () => showAbcQuestion('pain_trigger', 12),
      pain_trigger: () => showAbcQuestion('what_helps', 13),
      what_helps: () => showAbcQuestion('daily_impact', 14),
      daily_impact: () => showAbcQuestion('what_worsens', 15),
      what_worsens: () => showAbcQuestion('accompanying_feeling', 16),
      accompanying_feeling: () => showAbcQuestion('previous_attempts', 17),
      previous_attempts: () => showGoals(),
    };

    const next = flow[currentQuestion];
    if (next) {
      next();
    } else {
      console.warn(`No next screen for ${currentQuestion}`);
    }
  }


  // ============================================
  // SCREEN: PAIN SCALE — STEP 8
  // ============================================

  function showPainScale() {
    const initialValue = State.getAnswer('pain_scale') || 5;

    const html = `
      <h2 class="screen__title">Koliko je jak bol?</h2>
      <p class="screen__subtitle">Oceni intenzitet bola na skali od 1 do 10.</p>

      <div class="scale-container">
        <div class="scale-value" id="scaleValue">${initialValue}</div>

        <div class="scale-labels">
          <span>Blag bol</span>
          <span>Neizdrživo</span>
        </div>

        <input
          type="range"
          min="1"
          max="10"
          value="${initialValue}"
          step="1"
          class="scale-slider"
          id="scaleSlider"
        />

        <div class="scale-numbers scale-numbers--edges-only">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn--primary" id="continueBtn" disabled>NASTAVI ›</button>
      </div>
    `;

    setScreen(html, 'pain_scale', 7);

    const slider = document.getElementById('scaleSlider');
    const valueDisplay = document.getElementById('scaleValue');
    const continueBtn = document.getElementById('continueBtn');

    let userInteracted = State.getAnswer('pain_scale') !== null;
    if (userInteracted) continueBtn.disabled = false;

    function updateSliderBg(value) {
      const percentage = ((value - 1) / 9) * 100;
      slider.style.setProperty('--scale-progress', `${percentage}%`);

      let color;
      if (value <= 3) color = '#10b981';
      else if (value <= 6) color = '#f59e0b';
      else color = '#ef4444';

      valueDisplay.style.color = color;
    }

    updateSliderBg(initialValue);

    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      valueDisplay.textContent = value;
      updateSliderBg(value);

      if (!userInteracted) {
        userInteracted = true;
        continueBtn.disabled = false;
      }
    });

    continueBtn.addEventListener('click', () => {
      const value = parseInt(slider.value);
      handlePainScaleSelect(value);
    });
  }


  function handlePainScaleSelect(value) {
    State.setAnswer('pain_scale', value);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    // Fire-and-forget — ne čekamo API
    API.updateSession(sessionId, {
      pain_scale: value,
      current_step: 'pain_scale',
      current_step_number: 7,
    });
    API.logEvent(sessionId, 'step_completed', {
      step_number: 7,
      step_name: 'pain_scale',
      time_on_step: timeOnStep,
      metadata: { value },
    });

    showPainDuration();
  }


  // ============================================
  // SCREEN: PAIN DURATION — STEP 9
  // CHANGE: kompletno menjamo iz radio buttons u slider sa 12 vrednosti
  // Default: index 5 = "5 godina"
  // Boja: zeleno-žuto-crveno gradient kao pain_scale
  // ============================================

  function showPainDuration() {
    // 12 vrednosti slidera
    const durations = [
      '<1 godine',
      '1 godina',
      '2 godine',
      '3 godine',
      '4 godine',
      '5 godina',
      '6 godina',
      '7 godina',
      '8 godina',
      '9 godina',
      '10 godina',
      '10+ godina',
    ];

    // Pronađi prethodnu selekciju ako postoji (back navigation)
    const previousAnswer = State.getAnswer('pain_duration');
    const previousIndex = previousAnswer ? durations.indexOf(previousAnswer) : -1;
    const initialIndex = previousIndex >= 0 ? previousIndex : 5; // default na "5 godina"

    const html = `
      <h2 class="screen__title">Koliko dugo imaš bol?</h2>
      <p class="screen__subtitle">Izaberi koliko godina imaš ovaj problem.</p>

      <div class="scale-container">
        <div class="scale-value scale-value--duration" id="durationValue">${durations[initialIndex]}</div>

        <div class="scale-labels">
          <span>Manje</span>
          <span>Duže</span>
        </div>

        <input
          type="range"
          min="0"
          max="11"
          value="${initialIndex}"
          step="1"
          class="scale-slider"
          id="durationSlider"
        />

        <div class="scale-numbers scale-numbers--edges-only">
          <span>&lt;1 godine</span>
          <span>10+ godina</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn--primary" id="continueBtn" disabled>NASTAVI ›</button>
      </div>
    `;

    setScreen(html, 'pain_duration', 8);

    const slider = document.getElementById('durationSlider');
    const valueDisplay = document.getElementById('durationValue');
    const continueBtn = document.getElementById('continueBtn');

    let userInteracted = previousIndex >= 0;
    if (userInteracted) continueBtn.disabled = false;

    function updateSliderBg(index) {
      const percentage = (index / 11) * 100;
      slider.style.setProperty('--scale-progress', `${percentage}%`);

      let color;
      if (index <= 3) color = '#10b981';
      else if (index <= 7) color = '#f59e0b';
      else color = '#ef4444';

      valueDisplay.style.color = color;
    }

    updateSliderBg(initialIndex);

    slider.addEventListener('input', (e) => {
      const index = parseInt(e.target.value);
      valueDisplay.textContent = durations[index];
      updateSliderBg(index);

      if (!userInteracted) {
        userInteracted = true;
        continueBtn.disabled = false;
      }
    });

    continueBtn.addEventListener('click', () => {
      const index = parseInt(slider.value);
      const text = durations[index];
      handlePainDurationSelect(text);
    });
  }


  function handlePainDurationSelect(text) {
    State.setAnswer('pain_duration', text);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    // Fire-and-forget — ne čekamo API
    API.updateSession(sessionId, {
      pain_duration: text,
      current_step: 'pain_duration',
      current_step_number: 8,
    });
    API.logEvent(sessionId, 'step_completed', {
      step_number: 8,
      step_name: 'pain_duration',
      time_on_step: timeOnStep,
      metadata: { value: text },
    });

    showMidConclusion();
  }


  // ============================================
  // SCREEN: MID CONCLUSION — STEP 10
  // ============================================

  function showMidConclusion() {
    const html = `
      <div class="conclusion">
        <div class="conclusion__icon conclusion__icon--alert">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h2 class="conclusion__title">
          Problemi poput tvog često dovode do ukočenosti, iritacije nerva i upornog, neprijatnog bola.
        </h2>
        <div class="conclusion__callout">
          Ovakav obrazac viđamo često, i sledećim pitanjima ćemo još preciznije ustanoviti odakle problem dolazi.
        </div>

        <div class="actions">
          <button class="btn btn--primary" id="continueBtn">NASTAVI ›</button>
        </div>
      </div>
    `;

    setScreen(html, 'mid_conclusion', 9);

    document.getElementById('continueBtn').addEventListener('click', () => {
      setTimeout(() => {
        showAbcQuestion('pain_when', 11);
      }, 180);
    });
  }


  // ============================================
  // SCREEN: GOALS — STEP 18
  // VALIDACIJA: bar 1 cilj mora biti izabran
  // CHANGE: dodaje se drugi subtitle iznad postojeceg
  // ============================================

  function showGoals() {
    const goalsList = [
      'Da se probudim bez bola i ponovo uživam u svakom danu',
      'Da bez ograničenja trčim, igram se i budem uz svoju decu',
      'Da rešim problem bez operacije i dugoročnog oslanjanja na lekove',
      'Da popravim držanje i ponovo se osećam sigurno u svom telu',
      'Da vratim dobro raspoloženje i unutrašnji mir',
      'Da imam više energije, fokusa i motivacije za život koji želim',
    ];

    const currentlySelected = State.getAnswer('goals') || [];

    const optionsHtml = goalsList.map((goal) => {
      const isSelected = currentlySelected.includes(goal);
      return `
        <button class="option option--multiselect ${isSelected ? 'selected' : ''}" data-goal="${goal.replace(/"/g, '&quot;')}">
          <span class="option__checkbox"></span>
          <span class="option__text">${goal}</span>
        </button>
      `;
    }).join('');

    const html = `
      <h2 class="screen__title">Izaberi svoje ciljeve</h2>
      <p class="screen__subtitle screen__subtitle--emphasized">Oni će biti tvoja motivacija koja će te gurati napred kada odlučiš da živiš bez bola.</p>
      <p class="screen__subtitle">Možeš da izabereš jedan ili više ciljeva koji su ti najvažniji.</p>

      <div class="options-list" id="goalsList">
        ${optionsHtml}
      </div>

      <div class="form-error" id="goalsError" style="display: none;">
        Izaberi bar jedan cilj da bi nastavio dalje.
      </div>

      <div class="actions">
        <button class="btn btn--primary" id="continueBtn">NASTAVI ›</button>
      </div>
    `;

    setScreen(html, 'goals', 17);

    const continueBtn = document.getElementById('continueBtn');
    const errorEl = document.getElementById('goalsError');
    const goalsListEl = document.getElementById('goalsList');

    let hasAttemptedSubmit = false;

    function clearError() {
      errorEl.style.display = 'none';
      goalsListEl.classList.remove('options-list--error');
    }

    function showError() {
      errorEl.style.display = 'block';
      goalsListEl.classList.add('options-list--error');
    }

    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        opt.classList.toggle('selected');

        // Ako je korisnik već probao da klikne NASTAVI, real-time clear error kad selektuje opciju
        if (hasAttemptedSubmit) {
          const anySelected = document.querySelectorAll('.option.selected').length > 0;
          if (anySelected) {
            clearError();
          } else {
            showError();
          }
        }
      });
    });

    continueBtn.addEventListener('click', () => {
      const selectedGoals = Array.from(document.querySelectorAll('.option.selected'))
        .map(el => el.dataset.goal);

      if (selectedGoals.length === 0) {
        hasAttemptedSubmit = true;
        showError();
        return;
      }

      handleGoalsSelect(selectedGoals);
    });
  }


  function handleGoalsSelect(goals) {
    State.setAnswer('goals', goals);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    // Fire-and-forget — ne čekamo API
    API.updateSession(sessionId, {
      goals,
      current_step: 'goals',
      current_step_number: 17,
    });
    API.logEvent(sessionId, 'step_completed', {
      step_number: 17,
      step_name: 'goals',
      time_on_step: timeOnStep,
      metadata: { count: goals.length },
    });

    showEduBlock();
  }


  // ============================================
  // SCREEN: EDU BLOK — STEP 19
  // ============================================

  const eduSlides = [
    {
      type: 'warning',
      heading: 'Znamo da bol može da te odvoji od ciljeva',
      text: null,
      icon: 'goals',
    },
    {
      type: 'warning',
      heading: 'Znamo da bol može da se širi i postaje jači',
      text: 'Ako ne reaguješ na vreme, bol može da postane hroničan i da pokrene lančanu reakciju u telu, stvarajući nove probleme u ramenima, kukovima i kolenima.',
      icon: 'spread',
    },
    {
      type: 'warning',
      heading: 'Znamo da bol može da te mentalno iscrpljuje',
      text: 'Život sa stalnim bolom povećava rizik od anksioznosti, lošeg raspoloženja i problema sa snom, trošeći tvoju energiju i motivaciju.',
      icon: 'mental',
    },
    {
      type: 'positive',
      heading: 'Ali znaj da si u dobrim rukama',
      text: 'Imamo dovoljno informacija da tačno znamo zašto imaš problem, i kako da ti pomognemo.',
      icon: 'check',
    },
  ];


  function showEduBlock(slideIndex = 0) {
    const slide = eduSlides[slideIndex];
    const isPositive = slide.type === 'positive';

    document.body.className = isPositive ? 'edu-bg-positive' : 'edu-bg-warning';

    const existingSlide = document.querySelector('.edu-slide');

    if (existingSlide && State.getCurrentScreen() === 'edu_block') {
      animateEduSlideContent(slideIndex);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = `edu-transition-overlay ${isPositive ? 'edu-slide--positive' : 'edu-slide--warning'}`;
    document.body.appendChild(overlay);

    renderEduSlide(slideIndex);

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, 500);
  }


  function renderEduSlide(slideIndex) {
    const slide = eduSlides[slideIndex];
    const isLast = slideIndex === eduSlides.length - 1;
    const isPositive = slide.type === 'positive';

    const dotsHtml = eduSlides.map((_, idx) => `
      <span class="edu-dot ${idx === slideIndex ? 'edu-dot--active' : ''} ${idx < slideIndex ? 'edu-dot--passed' : ''}"></span>
    `).join('');

    const iconSvg = getEduIcon(slide.icon);
    const textHtml = slide.text ? `<p class="edu-slide__text">${slide.text}</p>` : '';

    const backBtnHtml = `
      <button class="edu-slide__back" id="eduBackBtn" aria-label="Nazad">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>
    `;

    const html = `
      <div class="edu-slide ${isPositive ? 'edu-slide--positive' : 'edu-slide--warning'}">
        <div class="edu-slide__top-bar">
          ${backBtnHtml}
          <div class="edu-slide__dots">${dotsHtml}</div>
        </div>

        <div class="edu-slide__content" id="eduContent">
          <div class="edu-slide__icon">${iconSvg}</div>
          <h2 class="edu-slide__heading">${slide.heading}</h2>
          ${textHtml}
        </div>

        <div class="edu-slide__actions">
          <button class="btn btn--edu" id="continueBtn">${isLast ? 'NASTAVI ›' : 'DALJE ›'}</button>
        </div>
      </div>
    `;

    setScreen(html, 'edu_block', 18);

    const contentEl = document.getElementById('eduContent');
    if (contentEl) {
      contentEl.style.opacity = '0';
      contentEl.style.transform = 'translateY(12px)';
      setTimeout(() => {
        contentEl.style.opacity = '1';
        contentEl.style.transform = 'translateY(0)';
      }, 100);
    }

    const backBtn = document.getElementById('eduBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (slideIndex === 0) {
          document.body.className = '';
          showGoals();
        } else {
          showEduBlock(slideIndex - 1);
        }
      });
    }

    document.getElementById('continueBtn').addEventListener('click', () => {
      if (isLast) {
        showCalculating();
      } else {
        showEduBlock(slideIndex + 1);
      }
    });

    attachEduDotListeners(slideIndex);
    attachEduSwipeListeners(slideIndex);
  }


  function animateEduSlideContent(slideIndex) {
    const slide = eduSlides[slideIndex];
    const isLast = slideIndex === eduSlides.length - 1;
    const isPositive = slide.type === 'positive';

    const eduSlideEl = document.querySelector('.edu-slide');
    const contentEl = document.getElementById('eduContent');
    const dotsContainer = document.querySelector('.edu-slide__dots');
    const continueBtn = document.getElementById('continueBtn');

    eduSlideEl.classList.remove('edu-slide--warning', 'edu-slide--positive');
    eduSlideEl.classList.add(isPositive ? 'edu-slide--positive' : 'edu-slide--warning');

    contentEl.style.opacity = '0';
    contentEl.style.transform = 'translateY(8px)';

    setTimeout(() => {
      const dots = dotsContainer.querySelectorAll('.edu-dot');
      dots.forEach((dot, idx) => {
        dot.classList.remove('edu-dot--active', 'edu-dot--passed');
        if (idx === slideIndex) dot.classList.add('edu-dot--active');
        else if (idx < slideIndex) dot.classList.add('edu-dot--passed');
      });

      const iconSvg = getEduIcon(slide.icon);
      const textHtml = slide.text ? `<p class="edu-slide__text">${slide.text}</p>` : '';
      contentEl.innerHTML = `
        <div class="edu-slide__icon">${iconSvg}</div>
        <h2 class="edu-slide__heading">${slide.heading}</h2>
        ${textHtml}
      `;

      continueBtn.textContent = isLast ? 'NASTAVI ›' : 'DALJE ›';

      const newBtn = continueBtn.cloneNode(true);
      continueBtn.parentNode.replaceChild(newBtn, continueBtn);
      newBtn.addEventListener('click', () => {
        if (isLast) {
          showCalculating();
        } else {
          showEduBlock(slideIndex + 1);
        }
      });

      const backBtn = document.getElementById('eduBackBtn');
      if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.addEventListener('click', () => {
          if (slideIndex === 0) {
            document.body.className = '';
            showGoals();
          } else {
            showEduBlock(slideIndex - 1);
          }
        });
      }

      contentEl.style.opacity = '1';
      contentEl.style.transform = 'translateY(0)';

      attachEduDotListeners(slideIndex);
      attachEduSwipeListeners(slideIndex);
    }, 200);
  }


  function attachEduDotListeners(currentIndex) {
    const dots = document.querySelectorAll('.edu-slide__dots .edu-dot');

    dots.forEach((dot, idx) => {
      const newDot = dot.cloneNode(true);
      dot.parentNode.replaceChild(newDot, dot);

      newDot.style.cursor = 'pointer';

      newDot.addEventListener('click', () => {
        if (idx !== currentIndex) {
          showEduBlock(idx);
        }
      });
    });
  }


  function attachEduSwipeListeners(currentIndex) {
    if (currentSwipeCleanup) {
      currentSwipeCleanup();
      currentSwipeCleanup = null;
    }

    const slideEl = document.querySelector('.edu-slide');
    if (!slideEl) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSwiping = false;

    const SWIPE_THRESHOLD = 60;
    const MAX_SWIPE_TIME = 500;
    const VERTICAL_TOLERANCE = 75;

    function handleTouchStart(e) {
      const touch = e.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isSwiping = true;
    }

    function handleTouchEnd(e) {
      if (!isSwiping) return;
      isSwiping = false;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      if (elapsed > MAX_SWIPE_TIME) return;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
      if (Math.abs(deltaY) > VERTICAL_TOLERANCE) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      if (deltaX < 0) {
        if (currentIndex < eduSlides.length - 1) {
          showEduBlock(currentIndex + 1);
        } else {
          showCalculating();
        }
      } else {
        if (currentIndex > 0) {
          showEduBlock(currentIndex - 1);
        }
      }
    }

    function handleTouchCancel() {
      isSwiping = false;
    }

    slideEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    slideEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    slideEl.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    currentSwipeCleanup = () => {
      slideEl.removeEventListener('touchstart', handleTouchStart);
      slideEl.removeEventListener('touchend', handleTouchEnd);
      slideEl.removeEventListener('touchcancel', handleTouchCancel);
    };
  }


  function getEduIcon(iconType) {
    const icons = {
      goals: `<svg width="120" height="120" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M357.208 97.9302C365.286 105.179 372.981 112.713 380.001 121C375.88 125.424 371.315 128.844 366.376 132.313C365.613 132.862 364.85 133.412 364.063 133.979C363.329 134.497 362.594 135.016 361.837 135.551C361.172 136.022 360.508 136.493 359.823 136.978C358.001 138 358.001 138 355.001 138C353.55 136.858 353.55 136.858 352.032 135.254C351.467 134.668 350.902 134.083 350.319 133.479C349.719 132.847 349.119 132.214 348.501 131.563C321.066 103.436 286.332 85.8023 248.001 78C246.952 77.7847 245.902 77.5695 244.821 77.3477C198.383 69.0852 148.663 80.9756 109.923 107.418C100.255 114.213 91.4905 121.799 83.0009 130C82.3499 130.599 81.699 131.199 81.0283 131.816C48.1998 162.782 30.865 210.612 29.1415 254.871C27.7099 305.76 46.8324 353.065 81.3783 390.181C108.445 418.812 144.438 436.895 183.001 444C184.381 444.267 184.381 444.267 185.79 444.54C195.327 446.218 204.723 446.398 214.376 446.375C215.212 446.375 216.048 446.375 216.909 446.374C230.601 446.34 243.679 445.376 257.001 442C258.156 441.711 258.156 441.711 259.334 441.417C264.293 440.139 269.149 438.633 274.001 437C275.878 436.391 275.878 436.391 277.794 435.77C295.495 429.755 312.305 420.513 327.001 409C327.862 408.348 328.723 407.695 329.61 407.023C339.485 399.381 349.252 390.828 357.001 381C357.432 380.454 357.864 379.908 358.308 379.345C378.388 353.741 392.09 325.083 398.001 293C398.269 291.614 398.269 291.614 398.543 290.2C400.204 280.761 400.358 271.489 400.313 261.938C400.312 261.12 400.31 260.302 400.308 259.46C400.261 247.092 399.782 235.098 397.001 223C396.824 222.211 396.647 221.422 396.465 220.608C393.512 207.761 389.568 195.227 383.77 183.367C383.394 182.596 383.018 181.826 382.631 181.032C381.892 179.54 381.137 178.056 380.365 176.582C377.831 171.527 377.831 171.527 378.654 168.978C380.252 166.631 381.865 165.398 384.212 163.801C385.045 163.232 385.877 162.663 386.735 162.076C387.607 161.494 388.478 160.912 389.376 160.313C390.24 159.719 391.103 159.125 391.993 158.514C399.034 153.749 399.034 153.749 403.001 153C416.917 177.869 426.529 204.605 430.001 233C430.094 233.704 430.187 234.409 430.282 235.134C431.245 243.314 431.244 251.525 431.251 259.75C431.252 260.525 431.252 261.3 431.253 262.099C431.176 317.822 409.302 370.45 370.51 410.439C368.978 412.024 367.468 413.628 365.958 415.234C335.893 446.746 292.905 467.718 250.001 474C248.267 474.262 248.267 474.262 246.499 474.529C236.262 475.954 226.204 476.361 215.876 476.312C215.068 476.311 214.261 476.309 213.429 476.307C200.418 476.258 187.788 475.569 175.001 473C174.163 472.839 173.326 472.678 172.463 472.512C134.709 465.061 99.6293 447.491 71.4814 421.293C69.3658 419.337 67.2085 417.474 65.0009 415.625C27.3262 382.612 4.45574 330.238 0.000907719 281C-0.154218 278.022 -0.207946 275.048 -0.237374 272.066C-0.252064 270.826 -0.25208 270.826 -0.267067 269.56C-0.51669 242.992 1.49027 218.371 10.0009 193C10.2842 192.152 10.5675 191.303 10.8593 190.429C19.4819 165.166 32.5427 142.178 50.0009 122C51.0064 120.828 51.0064 120.828 52.0322 119.633C112.419 50.9084 212.467 24.2006 357.208 97.9302Z" fill="currentColor"/>
        <path d="M214.875 113.75C215.617 113.749 216.359 113.749 217.124 113.748C228.052 113.764 238.378 114.207 249 117C250.009 117.25 250.009 117.25 251.038 117.504C278.578 124.375 303.633 139.251 323 160C320.759 165.521 315.857 168.024 311.125 171.313C310.213 171.971 309.302 172.629 308.363 173.307C307.483 173.924 306.602 174.54 305.695 175.176C304.891 175.742 304.087 176.308 303.258 176.892C301 178 301 178 298.837 177.786C296.235 176.673 294.639 174.98 292.625 173C270.404 152.504 239.423 143.128 209.573 144.077C186.909 145.346 165.328 152.55 147 166C146.247 166.53 145.494 167.06 144.718 167.606C134.273 175.269 124.755 184.939 118 196C117.356 197.022 116.713 198.045 116.051 199.098C100.071 225.609 93.9561 257.582 101.456 287.948C109.31 317.605 126.339 343.951 153 360C153.943 360.572 153.943 360.572 154.905 361.156C180.645 376.474 212.987 381.835 242.297 374.977C260.389 370.186 276.653 362.042 291 350C292.164 349.055 292.164 349.055 293.351 348.09C316.406 328.512 329.257 299.799 332 270C333.388 251.658 330.011 234.021 323.679 216.86C322.729 214.259 321.862 211.632 321 209C337.149 197.043 337.149 197.043 345 192C348.268 196.111 350.013 200.401 351.937 205.25C352.291 206.14 352.644 207.029 353.008 207.946C356.057 215.813 358.447 223.699 360 232C360.176 232.933 360.351 233.866 360.533 234.828C361.995 243.33 362.348 251.633 362.312 260.25C362.311 260.929 362.309 261.608 362.308 262.307C362.266 272.847 361.617 282.764 359 293C358.547 294.816 358.547 294.816 358.086 296.668C351.181 322.406 338.693 343.337 321 363C320.396 363.677 319.793 364.354 319.172 365.051C305.236 379.796 286.779 390.736 268 398C266.234 398.692 266.234 398.692 264.433 399.399C229.794 411.946 189.312 410.457 155.785 395.117C117.769 376.992 90.2841 347.497 75.8864 307.941C63.5615 270.586 65.9437 229.817 83.5522 194.481C90.4003 181.339 98.7216 169.697 109 159C109.44 158.529 109.88 158.057 110.334 157.571C137.245 128.798 175.791 113.782 214.875 113.75Z" fill="currentColor"/>
        <path d="M469.749 37.1873C472.341 39.2747 473.515 41.0272 474.999 43.9998C476.071 56.2413 472.022 69.9732 469.999 81.9998C470.95 82.158 470.95 82.158 471.92 82.3194C506.305 88.0741 506.305 88.0741 511.312 94.7498C512.354 98.1609 512.919 101.547 511.999 105C508.254 109.411 503.627 112.613 498.937 115.937C498.16 116.493 497.383 117.048 496.582 117.621C494.059 119.42 491.53 121.211 488.999 123C488.12 123.623 487.241 124.245 486.335 124.887C483.684 126.762 481.03 128.632 478.374 130.5C477.558 131.075 476.742 131.649 475.901 132.242C474.34 133.334 472.771 134.415 471.194 135.484C469.795 136.45 468.424 137.457 467.094 138.515C458.372 145.008 446.899 142.042 436.841 140.578C435.594 140.387 434.347 140.196 433.062 140C430.532 139.621 428.003 139.246 425.472 138.875C424.371 138.707 423.27 138.54 422.136 138.367C415.146 137.51 415.146 137.51 408.96 140.351C407.858 141.123 407.858 141.123 406.733 141.91C405.955 142.476 405.176 143.042 404.374 143.625C403.548 144.208 402.722 144.791 401.871 145.392C400.123 146.627 398.38 147.868 396.64 149.114C393.242 151.541 389.814 153.926 386.387 156.312C378.709 161.662 371.068 167.064 363.426 172.465C355.485 178.076 347.516 183.646 339.548 189.218C335.364 192.144 331.182 195.072 326.999 198C325.333 199.166 323.666 200.333 321.999 201.5C321.174 202.077 320.349 202.655 319.499 203.25C311.999 208.5 311.999 208.5 309.499 210.25C307.834 211.415 306.17 212.58 304.506 213.745C300.303 216.688 296.099 219.63 291.894 222.57C283.403 228.509 274.921 234.459 266.461 240.441C259.857 245.109 253.229 249.742 246.597 254.369C245.795 254.929 244.993 255.489 244.167 256.066C243.459 256.561 242.75 257.055 242.02 257.564C241.353 258.038 240.686 258.512 239.999 259C238.907 259.77 238.907 259.77 237.793 260.555C235.573 262.343 235.246 263.579 234.562 266.312C232.825 272.054 230.379 275.395 225.312 278.812C218.835 281.134 212.341 282.042 205.89 279.222C201.376 276.303 197.697 272.093 195.999 267C195.369 258.601 195.711 252.928 201.249 246.312C204.31 243.739 207.086 241.851 210.999 241C212.626 241.171 214.251 241.361 215.874 241.562C224.302 241.78 230.291 235.669 236.636 230.788C240.671 227.736 244.841 224.88 248.999 222C250.698 220.813 252.396 219.626 254.093 218.437C254.918 217.86 255.743 217.282 256.593 216.687C260.235 214.133 263.868 211.567 267.499 209C276.13 202.899 284.789 196.839 293.451 190.782C297.635 187.856 301.817 184.928 305.999 182C307.666 180.833 309.333 179.666 310.999 178.5C311.824 177.922 312.649 177.345 313.499 176.75C320.999 171.5 320.999 171.5 323.5 169.749C325.164 168.584 326.829 167.419 328.493 166.254C332.696 163.312 336.9 160.37 341.105 157.429C348.914 151.968 356.718 146.5 364.499 141C370.886 136.486 377.282 131.988 383.687 127.5C384.944 126.618 384.944 126.618 386.226 125.719C387.021 125.162 387.817 124.605 388.636 124.031C389.334 123.542 390.033 123.053 390.752 122.549C392.999 121 392.999 121 396.119 119.398C400.219 115.984 400.543 112.703 401.449 107.597C401.725 106.225 401.725 106.225 402.007 104.826C402.59 101.909 403.14 98.9865 403.687 96.0623C404.249 93.143 404.819 90.2255 405.399 87.3097C405.758 85.4978 406.106 83.6836 406.441 81.8672C407.618 75.8022 409.057 71.0778 414.23 67.2732C414.86 66.8045 415.49 66.3358 416.139 65.8528C416.814 65.3651 417.49 64.8773 418.187 64.3748C418.894 63.8548 419.601 63.3348 420.329 62.7991C426.489 58.2971 432.77 53.9732 439.081 49.6873C443.645 46.5789 448.12 43.3495 452.572 40.0833C458.062 36.1028 463.203 34.3605 469.749 37.1873Z" fill="currentColor"/>
        <path d="M262.999 197C265.343 199.719 265.343 199.719 266.999 202C266.105 202.641 265.21 203.281 264.289 203.941C263.708 204.357 263.127 204.773 262.529 205.202C261.253 206.113 259.976 207.021 258.697 207.927C255.77 210 252.885 212.089 250.054 214.293C243.789 219.093 243.789 219.093 239.812 218.625C238.884 218.089 237.956 217.552 236.999 217C231.897 214.546 227.366 213.301 221.749 212.687C221.004 212.605 220.258 212.522 219.489 212.437C207.123 211.264 195.466 214.708 185.746 222.492C175.348 231.471 168.318 242.861 167.249 256.75C166.418 271.119 171.453 282.933 180.589 293.91C189.286 303.22 200.767 308.07 213.374 308.996C228.034 309.018 240.475 303.111 250.933 293.16C255.747 288.098 258.506 282.481 260.999 276C261.384 275.108 261.768 274.216 262.164 273.297C262.94 270.235 263.013 268.336 262.816 265.242C262.036 251.538 262.036 251.538 265.61 246.918C269.627 243.302 274.165 240.621 278.938 238.12C280.867 237.072 282.588 235.915 284.363 234.629C285.233 234.091 286.103 233.554 286.999 233C287.989 233.33 288.979 233.66 289.999 234C297.299 251.87 295.591 273.532 288.749 291.187C280.348 310.016 265.581 325.737 246.316 333.48C224.924 341.192 202.49 341.266 181.672 331.907C175.577 328.992 170.239 325.256 164.999 321C164.186 320.393 163.373 319.786 162.535 319.16C146.783 305.738 138.989 285.652 137.124 265.5C136.172 242.834 143.377 223.011 158.285 205.816C185.855 177.214 230.903 174.184 262.999 197Z" fill="currentColor"/>
      </svg>`,
      spread: `<svg width="120" height="120" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="spread-pulse">
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2"/>
          <circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/>
          <circle cx="40" cy="40" r="18" fill="none" stroke="currentColor" stroke-width="2" opacity="0.65"/>
          <circle cx="40" cy="40" r="10" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.9"/>
          <circle cx="40" cy="40" r="5" fill="currentColor"/>
        </g>
      </svg>`,
      mental: `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path>
      </svg>`,
      check: `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"></path>
      </svg>`,
    };
    return icons[iconType] || icons.goals;
  }


  // ============================================
  // SCREEN: CALCULATING — STEP 20
  // ============================================

  function showCalculating() {
    const messages = [
      'Analiziram tvoje odgovore...',
      'Identifikujem obrazac bola...',
      'Pripremam personalizovan plan...',
      'Skoro gotovo...',
    ];

    const html = `
      <div class="calculating">
        <div class="calculating__progress-wrapper">
          <svg class="calculating__circle" width="200" height="200" viewBox="0 0 200 200">
            <circle
              cx="100" cy="100" r="88"
              fill="none"
              stroke="rgba(22, 162, 157, 0.15)"
              stroke-width="10"
            />
            <circle
              id="calcCircleProgress"
              cx="100" cy="100" r="88"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="552.92"
              stroke-dashoffset="552.92"
              transform="rotate(-90 100 100)"
              style="transition: stroke-dashoffset 100ms linear;"
            />
          </svg>

          <div class="calculating__percentage" id="calcPercentage">0%</div>
        </div>

        <h2 class="calculating__title">Pripremamo tvoje rezultate</h2>
        <p class="calculating__message" id="calcMessage">${messages[0]}</p>
      </div>
    `;

    setScreen(html, 'calculating', 19, { hideBack: true });

    const percentageEl = document.getElementById('calcPercentage');
    const circleEl = document.getElementById('calcCircleProgress');
    const messageEl = document.getElementById('calcMessage');

    const DURATION = 3000;
    const CIRCUMFERENCE = 552.92;

    let startTime = null;
    let messageIndex = 0;
    let lastMessageChange = 0;
    const MESSAGE_INTERVAL = 750;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / DURATION, 1);

      const easedProgress = easeOutCubic(progress);
      const percentage = Math.round(easedProgress * 100);
      percentageEl.textContent = `${percentage}%`;

      const offset = CIRCUMFERENCE * (1 - easedProgress);
      circleEl.style.strokeDashoffset = offset;

      if (elapsed - lastMessageChange >= MESSAGE_INTERVAL && messageIndex < messages.length - 1) {
        messageIndex++;
        lastMessageChange = elapsed;
        messageEl.style.opacity = '0';
        setTimeout(() => {
          messageEl.textContent = messages[messageIndex];
          messageEl.style.opacity = '1';
        }, 180);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          showLeadForm();
        }, 500);
      }
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    requestAnimationFrame(animate);
  }


  // ============================================
  // SCREEN: LEAD FORM — STEP 21
  // VALIDACIJA: ime min 2 char, email mora biti validan
  // ============================================

  // Email validacija — standardna sa sanity check-ovima
  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Bez razmaka
    if (/\s/.test(email)) return false;
    
    // Tačno jedan @
    const atCount = (email.match(/@/g) || []).length;
    if (atCount !== 1) return false;
    
    // Split na local i domain part
    const [local, domain] = email.split('@');
    
    // Local part: bar 1 karakter
    if (!local || local.length === 0) return false;
    
    // Local part ne može počinjati ili završavati tačkom
    if (local.startsWith('.') || local.endsWith('.')) return false;
    
    // Local part bez duplih tačaka
    if (local.includes('..')) return false;
    
    // Domain part: bar 1 tačka
    if (!domain || !domain.includes('.')) return false;
    
    // Domain ne može počinjati ili završavati tačkom
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    
    // Domain bez duplih tačaka
    if (domain.includes('..')) return false;
    
    // Split domain po tačkama
    const domainParts = domain.split('.');
    
    // Bar 2 dela u domenu (npr. gmail + com)
    if (domainParts.length < 2) return false;
    
    // Svaki deo mora imati bar 1 karakter
    if (domainParts.some(p => p.length === 0)) return false;
    
    // TLD (poslednji deo) bar 2 karaktera
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) return false;
    
    // Validni karakteri (slova, brojevi, plus, minus, underscore, tačka u local; slova, brojevi, minus, tačka u domenu)
    const localPattern = /^[a-zA-Z0-9._+-]+$/;
    const domainPattern = /^[a-zA-Z0-9.-]+$/;
    
    if (!localPattern.test(local)) return false;
    if (!domainPattern.test(domain)) return false;
    
    return true;
  }


  function showLeadForm() {
    const html = `
      <div class="lead-form-screen">
        <div class="lead-form__header">
          <div class="lead-form__icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </div>
          <h2 class="lead-form__title">Tvoji rezultati su spremni!</h2>
          <p class="lead-form__subtitle">
            Unesi svoje podatke da pogledaš detaljnu analizu i preporučena rešenja.
          </p>
        </div>

        <form class="lead-form" id="leadForm" novalidate>
          <div class="form-field">
            <label for="leadName">Ime <span class="required">*</span></label>
            <input
              type="text"
              id="leadName"
              name="name"
              placeholder="Tvoje ime"
              autocomplete="given-name"
            />
            <span class="form-field__error" id="nameError"></span>
          </div>

          <div class="form-field">
            <label for="leadEmail">Email <span class="required">*</span></label>
            <input
              type="email"
              id="leadEmail"
              name="email"
              placeholder="tvoj@email.com"
              autocomplete="email"
              required
            />
            <span class="form-field__error" id="emailError"></span>
          </div>

          <button type="submit" class="btn btn--primary btn--large" id="leadSubmitBtn">
            POGLEDAJ REZULTATE ›
          </button>
        </form>

        <div class="lead-form__trust">
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Tvoji podaci su sigurni</span>
          </div>
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Bez spam-a, samo tvoji rezultati</span>
          </div>
        </div>
      </div>
    `;

    setScreen(html, 'lead_form', 20, { hideBack: true });

    const form = document.getElementById('leadForm');
    const nameInput = document.getElementById('leadName');
    const emailInput = document.getElementById('leadEmail');
    const nameError = document.getElementById('nameError');
    const emailError = document.getElementById('emailError');
    const submitBtn = document.getElementById('leadSubmitBtn');

    let hasAttemptedSubmit = false;

    // Validacije
    function validateName(name) {
      const trimmed = (name || '').trim();
      if (trimmed.length === 0) {
        return { valid: false, error: 'Ime je obavezno' };
      }
      if (trimmed.length < 2) {
        return { valid: false, error: 'Ime mora imati bar 2 karaktera' };
      }
      return { valid: true };
    }

    function validateEmail(email) {
      const trimmed = (email || '').trim();
      if (trimmed.length === 0) {
        return { valid: false, error: 'Email je obavezan' };
      }
      if (!isValidEmail(trimmed)) {
        return { valid: false, error: 'Email nije validan' };
      }
      return { valid: true };
    }

    // UI helpers
    function setFieldError(input, errorEl, message) {
      input.classList.add('input--error');
      errorEl.textContent = message;
    }

    function clearFieldError(input, errorEl) {
      input.classList.remove('input--error');
      errorEl.textContent = '';
    }

    function checkAndUpdateField(input, errorEl, validator) {
      const result = validator(input.value);
      if (result.valid) {
        clearFieldError(input, errorEl);
      } else {
        setFieldError(input, errorEl, result.error);
      }
      return result.valid;
    }

    // Real-time validacija (samo posle prvog submit-a)
    nameInput.addEventListener('input', () => {
      if (hasAttemptedSubmit) {
        checkAndUpdateField(nameInput, nameError, validateName);
      }
    });

    emailInput.addEventListener('input', () => {
      if (hasAttemptedSubmit) {
        checkAndUpdateField(emailInput, emailError, validateEmail);
      }
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hasAttemptedSubmit = true;

      // Validate both fields
      const nameValid = checkAndUpdateField(nameInput, nameError, validateName);
      const emailValid = checkAndUpdateField(emailInput, emailError, validateEmail);

      if (!nameValid || !emailValid) {
        // Focus na prvi polje sa error-om
        if (!nameValid) {
          nameInput.focus();
        } else {
          emailInput.focus();
        }
        return;
      }

      // Sve validno — submit
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();

      submitBtn.disabled = true;
      submitBtn.textContent = 'ŠALJEM...';

      const sessionId = State.getSessionId();
      const result = await API.completeSession(sessionId, { name, email });

      if (!result.success) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'POGLEDAJ REZULTATE ›';
        setFieldError(emailInput, emailError, result.error || 'Greška, pokušaj ponovo');
        console.error('completeSession failed:', result);
        return;
      }

      State.setAnswer('name', name);
      State.setAnswer('email', email);

      await API.logEvent(sessionId, 'lead_submitted', {
        step_number: 20,
        step_name: 'lead_form',
        time_on_step: State.getTimeOnCurrentScreen(),
      });

      redirectToVSL();
    });

    setTimeout(() => nameInput.focus(), 100);
  }


  // ============================================
  // REDIRECT NA KLIJENTOV VSL
  // ============================================

  function redirectToVSL() {
    const diagnosis = State.getAnswer('diagnosis');
    const allAnswers = State.getAllAnswers();

    const VSL_PATHS = {
      muscle: '/misicni-bol',
      hernia: '/diskus-hernija',
    };

    const path = VSL_PATHS[diagnosis] || VSL_PATHS.muscle;
    const baseUrl = `${window.location.origin}${path}`;

    const params = new URLSearchParams({
      pain_desc: allAnswers.pain_description?.text || '',
      duration: allAnswers.pain_duration || '',
      scale: allAnswers.pain_scale || '',
      name: allAnswers.name || '',
    });

    const finalUrl = `${baseUrl}?${params.toString()}`;

    console.log('[quiz] Redirecting to VSL:', finalUrl);

    window.location.replace(finalUrl);
  }


  function showPlaceholder(message) {
    const html = `
      <h2 class="screen__title">${message}</h2>
      <p class="screen__subtitle">
        <strong>Session ID:</strong> <code style="font-size: 11px;">${State.getSessionId()}</code><br><br>
        <strong>Trenutni odgovori:</strong>
      </p>
      <pre style="background: #f5f5fa; padding: 16px; border-radius: 12px; font-size: 12px; overflow-x: auto;">${JSON.stringify(State.getAllAnswers(), null, 2)}</pre>
    `;
    setScreen(html, 'placeholder', 1);
  }


  return {
    init,
  };

})();


document.addEventListener('DOMContentLoaded', () => {
  Quiz.init();
});

console.log('[quiz.js] učitan');
