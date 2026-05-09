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

  // Trenutna back funkcija (svaki screen je postavlja)
  let currentBackHandler = null;

  // Privremeni opts kada se zove showScreenByName (npr. za back navigation)
  let pendingScreenOpts = null;

  // Globalna referenca na trenutnog swipe handler-a (za cleanup)
  let currentSwipeCleanup = null;

  // Total screens (za progress kalkulaciju) — 22 ukupno
  const TOTAL_SCREENS = 22;


  // ============================================
  // INICIJALIZACIJA
  // ============================================

  async function init() {
    screensContainer = document.getElementById('quizScreens');
    progressBar = document.getElementById('progressBar');
    progressBarFill = document.getElementById('progressBarFill');
    globalBackBtn = document.getElementById('globalBackBtn');

    if (!screensContainer) {
      console.error('Quiz: ne mogu da nađem #quizScreens element');
      return;
    }

    // Globalni back dugme handler
    globalBackBtn.addEventListener('click', () => {
      if (currentBackHandler) {
        currentBackHandler();
      }
    });

    // Odmah kreiraj sesiju i prikaži prvi screen
    await startSession();
  }


  // ============================================
  // START - Kreira sesiju i pokazuje prvi screen
  // ============================================

  async function startSession() {
    // Privremeno prikaži loading
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

    // Idi na prvi screen — Welcome
    showWelcome();
  }


  // ============================================
  // SCREEN RENDERING (univerzalna funkcija)
  // ============================================

  function setScreen(html, screenName, screenNumber = null, opts = {}) {
    // Cleanup swipe listener-a kad pređemo van edu slideshow-a
    if (screenName !== 'edu_block' && currentSwipeCleanup) {
      currentSwipeCleanup();
      currentSwipeCleanup = null;
    }

    // Reset body class (skida edu pozadinu kad pređemo dalje)
    if (screenName !== 'edu_block') {
      document.body.className = '';
    }

    // Merge sa pendingScreenOpts (postavlja showScreenByName kad ide back)
    if (pendingScreenOpts) {
      opts = { ...opts, ...pendingScreenOpts };
    }

    State.setCurrentScreen(screenName, { skipHistory: opts.isBackNavigation });

    screensContainer.innerHTML = `
      <div class="screen" data-screen="${screenName}">
        ${html}
      </div>
    `;

    // Sakrij progress + back na edu slide-ovima (imaju svoje dot indicators)
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

    // Back dugme: sakriveno ako je prvi screen ili eksplicitno hideBack: true
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

    // Loguj 'step_viewed' event
    if (screenNumber !== null) {
      API.logEvent(State.getSessionId(), 'step_viewed', {
        step_number: screenNumber,
        step_name: screenName,
      });
    }
  }


  /**
   * Default back handler - vraća na prethodni screen iz history-ja
   */
  function goBack() {
    const targetScreen = State.popScreenHistory();

    if (!targetScreen) {
      console.warn('Nema prethodnog screen-a u history-ju');
      return;
    }

    showScreenByName(targetScreen, { isBackNavigation: true });
  }


  /**
   * Pomoćna funkcija - poziva show* funkciju po imenu screen-a
   */
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
  // SCREEN: WELCOME (Započni kviz)
  // ============================================

  function showWelcome() {
    const html = `
      <div class="welcome">
        <span class="welcome__eyebrow">PERSONALIZOVAN KVIZ</span>

        <h1 class="welcome__title">Otkrij uzrok svog bola za 2 minuta</h1>

        <p class="welcome__subtitle">
          Odgovori na nekoliko pitanja i dobićeš personalizovan plan rešavanja bola — potpuno besplatno.
        </p>

        <div class="welcome__divider"></div>

        <ul class="welcome__benefits">
          <li>
            <span class="welcome__benefit-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <div>
              <strong>Personalizovan plan</strong>
              <span>Tačno za tvoj tip bola</span>
            </div>
          </li>
          <li>
            <span class="welcome__benefit-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <div>
              <strong>Bez registracije</strong>
              <span>Samo email na kraju</span>
            </div>
          </li>
          <li>
            <span class="welcome__benefit-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <div>
              <strong>100% besplatno</strong>
              <span>Bez skrivenih troškova</span>
            </div>
          </li>
        </ul>

        <div class="actions">
          <button class="btn btn--primary btn--large" id="startBtn">ZAPOČNI KVIZ ›</button>
        </div>

        <div class="welcome__trust">
          <div class="welcome__trust-avatars">
            <div class="welcome__trust-avatar"></div>
            <div class="welcome__trust-avatar"></div>
            <div class="welcome__trust-avatar"></div>
          </div>
          <span>3,500+ ljudi je već uradilo ovaj kviz</span>
        </div>
      </div>
    `;

    setScreen(html, 'welcome', null, { hideBack: true });

    document.getElementById('startBtn').addEventListener('click', () => {
      setTimeout(() => {
        showGender();
      }, 50);
    });
  }

  // ============================================
  // SCREEN: GENDER SELECTION
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

    setScreen(html, 'gender', 1, { hideBack: true });

    document.querySelectorAll('.gender-card').forEach(card => {
      card.addEventListener('click', () => handleGenderSelect(card.dataset.gender));
    });
  }


  async function handleGenderSelect(gender) {
    State.setAnswer('gender', gender);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    await Promise.all([
      API.updateSession(sessionId, {
        gender,
        current_step: 'gender',
        current_step_number: 1,
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: 1,
        step_name: 'gender',
        time_on_step: timeOnStep,
        metadata: { value: gender },
      }),
    ]);

    showPainLocation();
  }


  // ============================================
  // SCREEN: PAIN LOCATION (Vrat / Srednja / Donja leđa)
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
        }, 25);
      });
    });
  }


  async function handlePainLocationSelect(location) {
    State.setAnswer('pain_location', location);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    await Promise.all([
      API.updateSession(sessionId, {
        pain_location: location,
        current_step: 'pain_location',
        current_step_number: 2,
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: 2,
        step_name: 'pain_location',
        time_on_step: timeOnStep,
        metadata: { value: location },
      }),
    ]);

    showPainLocationConclusion(location);
  }


  // ============================================
  // SCREEN: PAIN LOCATION CONCLUSION (statistika)
  // ============================================

  function showPainLocationConclusion(location) {
    const conclusions = {
      neck: { percentage: 34, bodyPart: 'vratu' },
      middle: { percentage: 18, bodyPart: 'srednjem delu leđa' },
      lower: { percentage: 48, bodyPart: 'donjim leđima' },
    };

    const conclusion = conclusions[location];

    // Kičma sa highlight-om na različitom mestu za svaku lokaciju bola
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
      }, 50);
    });
  }


  // ============================================
  // SCREEN: PAIN RADIATES (DA/NE → diagnosis)
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
          <span class="option__text">Ne, bol ostaje samo u ${painLocation === 'lower' ? 'leđima' : (painLocation === 'neck' ? 'vratu' : 'leđima')}</span>
        </button>
        <button class="option" data-radiates="true">
          <span class="option__indicator"></span>
          <span class="option__text">Da, ${painLocation === 'lower' ? 'širi se niz nogu' : 'širi se niz ruku'}</span>
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
        }, 25);
      });
    });
  }


  async function handlePainRadiatesSelect(radiates) {
    State.setAnswer('pain_radiates', radiates);
    const diagnosis = State.getAnswer('diagnosis');

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    await Promise.all([
      API.updateSession(sessionId, {
        pain_radiates: radiates,
        diagnosis,
        current_step: 'pain_radiates',
        current_step_number: 4,
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: 4,
        step_name: 'pain_radiates',
        time_on_step: timeOnStep,
        metadata: { value: radiates, diagnosis },
      }),
    ]);

    showAbcQuestion('pain_frequency', 5);
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
        }, 25);
      });
    });
  }


  async function handleAbcSelect(questionKey, screenNumber, answer) {
    State.setAnswer(questionKey, answer);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    const allAnswers = State.getAllAnswers();
    await Promise.all([
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
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: screenNumber,
        step_name: questionKey,
        time_on_step: timeOnStep,
        metadata: { value: answer.value },
      }),
    ]);

    routeNextAbc(questionKey);
  }


  function routeNextAbc(currentQuestion) {
    const flow = {
      pain_frequency: () => showAbcQuestion('pain_description', 6),
      pain_description: () => showPainScale(),
      pain_when: () => showAbcQuestion('pain_trigger', 11),
      pain_trigger: () => showAbcQuestion('what_helps', 12),
      what_helps: () => showAbcQuestion('daily_impact', 13),
      daily_impact: () => showAbcQuestion('what_worsens', 14),
      what_worsens: () => showAbcQuestion('accompanying_feeling', 15),
      accompanying_feeling: () => showAbcQuestion('previous_attempts', 16),
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
  // SCREEN: PAIN SCALE (slider 1-10)
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

        <div class="scale-numbers">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}
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


  async function handlePainScaleSelect(value) {
    State.setAnswer('pain_scale', value);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    await Promise.all([
      API.updateSession(sessionId, {
        pain_scale: value,
        current_step: 'pain_scale',
        current_step_number: 7,
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: 7,
        step_name: 'pain_scale',
        time_on_step: timeOnStep,
        metadata: { value },
      }),
    ]);

    showPainDuration();
  }


  // ============================================
  // SCREEN: PAIN DURATION
  // ============================================

  function showPainDuration() {
    const options = [
      { value: 'less_than_month', text: 'Manje od mesec dana' },
      { value: '1_to_6_months', text: '1 do 6 meseci' },
      { value: '6_to_12_months', text: '6 do 12 meseci' },
      { value: '1_to_3_years', text: '1 do 3 godine' },
      { value: 'more_than_3_years', text: 'Više od 3 godine' },
    ];

    const optionsHtml = options.map(opt => `
      <button class="option" data-value="${opt.value}" data-text="${opt.text}">
        <span class="option__indicator"></span>
        <span class="option__text">${opt.text}</span>
      </button>
    `).join('');

    const html = `
      <h2 class="screen__title">Koliko dugo imaš ovaj problem?</h2>
      <p class="screen__subtitle">Što duže traje, to je važnije reagovati na vreme.</p>

      <div class="options-list">
        ${optionsHtml}
      </div>
    `;

    setScreen(html, 'pain_duration', 8);

    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.querySelectorAll('.option').forEach(o => o.disabled = true);

        setTimeout(() => {
          handlePainDurationSelect({
            value: opt.dataset.value,
            text: opt.dataset.text,
          });
        }, 25);
      });
    });
  }


  async function handlePainDurationSelect(answer) {
    State.setAnswer('pain_duration', answer.text);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    await Promise.all([
      API.updateSession(sessionId, {
        pain_duration: answer.text,
        current_step: 'pain_duration',
        current_step_number: 8,
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: 8,
        step_name: 'pain_duration',
        time_on_step: timeOnStep,
        metadata: { value: answer.value, text: answer.text },
      }),
    ]);

    showMidConclusion();
  }


  // ============================================
  // SCREEN: MID CONCLUSION
  // ============================================

  function showMidConclusion() {
    const html = `
      <div class="conclusion">
        <div class="conclusion__icon conclusion__icon--alert">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        showAbcQuestion('pain_when', 10);
      }, 50);
    });
  }


  // ============================================
  // SCREEN: GOALS (multi-select)
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
      <p class="screen__subtitle">Možeš da izabereš jedan ili više ciljeva koji su ti najvažniji.</p>

      <div class="options-list">
        ${optionsHtml}
      </div>

      <div class="actions">
        <button class="btn btn--primary" id="continueBtn" ${currentlySelected.length === 0 ? 'disabled' : ''}>NASTAVI ›</button>
      </div>
    `;

    setScreen(html, 'goals', 17);

    const continueBtn = document.getElementById('continueBtn');

    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        opt.classList.toggle('selected');

        const anySelected = document.querySelectorAll('.option.selected').length > 0;
        continueBtn.disabled = !anySelected;
      });
    });

    continueBtn.addEventListener('click', () => {
      const selectedGoals = Array.from(document.querySelectorAll('.option.selected'))
        .map(el => el.dataset.goal);
      handleGoalsSelect(selectedGoals);
    });
  }


  async function handleGoalsSelect(goals) {
    State.setAnswer('goals', goals);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    await Promise.all([
      API.updateSession(sessionId, {
        goals,
        current_step: 'goals',
        current_step_number: 17,
      }),
      API.logEvent(sessionId, 'step_completed', {
        step_number: 17,
        step_name: 'goals',
        time_on_step: timeOnStep,
        metadata: { count: goals.length },
      }),
    ]);

    showEduBlock();
  }


  // ============================================
  // SCREEN: EDU BLOK (slideshow)
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

    // Set body class odmah (sprečava flash bele pozadine)
    document.body.className = isPositive ? 'edu-bg-positive' : 'edu-bg-warning';

    const existingSlide = document.querySelector('.edu-slide');

    if (existingSlide && State.getCurrentScreen() === 'edu_block') {
      // Tranzicija unutar slideshow-a (slide 1 → 2 → 3 → 4)
      animateEduSlideContent(slideIndex);
      return;
    }

    // PRVI ulazak u edu — overlay maska sakriva glitch
    // Korak 1: kreiraj overlay (z-index 200, prekriva sve)
    const overlay = document.createElement('div');
    overlay.className = `edu-transition-overlay ${isPositive ? 'edu-slide--positive' : 'edu-slide--warning'}`;
    document.body.appendChild(overlay);

    // Korak 2: ODMAH renderuj slide ispod overlay-a
    // Slide se layoutuje dok je overlay vidljiv → korisnik ne vidi glitch
    renderEduSlide(slideIndex);

    // Korak 3: sačekaj 500ms (slide se kompletno layoutovao + browser stabilan)
    // pa onda fade-out overlay
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

    // Back button na svim slide-ovima
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

    // Fade-in animacija za sadržaj (smooth ulazak iza overlay-a)
    const contentEl = document.getElementById('eduContent');
    if (contentEl) {
      contentEl.style.opacity = '0';
      contentEl.style.transform = 'translateY(12px)';
      setTimeout(() => {
        contentEl.style.opacity = '1';
        contentEl.style.transform = 'translateY(0)';
      }, 100);
    }

    // Back button handler
    // Na prvom slide-u → vrati na Goals screen
    // Na ostalima → vrati na prethodni edu slide
    const backBtn = document.getElementById('eduBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (slideIndex === 0) {
          // Reset body class i edu state pre povratka na Goals
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

    // Klikabilni dot indicators
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

      // Re-bind back button handler sa novim slideIndex
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

      // Re-attach dot listeners za nov slideIndex
      attachEduDotListeners(slideIndex);

      attachEduSwipeListeners(slideIndex);
    }, 200);
  }

  /**
   * Dodaje klik handlere na dot indicators
   * Klik na dot vodi na taj slide
   */
  function attachEduDotListeners(currentIndex) {
    const dots = document.querySelectorAll('.edu-slide__dots .edu-dot');
    
    dots.forEach((dot, idx) => {
      // Skloni stare handlere kloniranjem
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
      goals: `<svg width="120" height="120" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <circle cx="36" cy="44" r="22"/>
          <circle cx="36" cy="44" r="14"/>
          <circle cx="36" cy="44" r="6"/>
        </g>
        <g stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <line x1="36" y1="44" x2="68" y2="12"/>
          <polyline points="60 12 68 12 68 20"/>
          <line x1="28" y1="52" x2="32" y2="48"/>
          <line x1="32" y1="56" x2="36" y2="52"/>
        </g>
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
  // SCREEN: CALCULATING ANIMACIJA
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

    API.logEvent(State.getSessionId(), 'step_viewed', {
      step_number: 19,
      step_name: 'calculating',
    });

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
        }, 150);
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
  // SCREEN: LEAD FORM
  // ============================================

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
            <label for="leadName">Ime</label>
            <input
              type="text"
              id="leadName"
              name="name"
              placeholder="Tvoje ime"
              autocomplete="given-name"
            />
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
    const emailError = document.getElementById('emailError');
    const submitBtn = document.getElementById('leadSubmitBtn');

    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    emailInput.addEventListener('blur', () => {
      const email = emailInput.value.trim();
      if (email && !isValidEmail(email)) {
        emailError.textContent = 'Unesi validan email';
        emailInput.classList.add('input--error');
      } else {
        emailError.textContent = '';
        emailInput.classList.remove('input--error');
      }
    });

    emailInput.addEventListener('input', () => {
      emailError.textContent = '';
      emailInput.classList.remove('input--error');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();

      if (!email) {
        emailError.textContent = 'Email je obavezan';
        emailInput.classList.add('input--error');
        emailInput.focus();
        return;
      }

      if (!isValidEmail(email)) {
        emailError.textContent = 'Unesi validan email';
        emailInput.classList.add('input--error');
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'ŠALJEM...';

      const sessionId = State.getSessionId();
      const result = await API.completeSession(sessionId, { name: name || null, email });

      if (!result.success) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'POGLEDAJ REZULTATE ›';
        emailError.textContent = result.error || 'Greška, pokušaj ponovo';
        console.error('completeSession failed:', result);
        return;
      }

      State.setAnswer('name', name || null);
      State.setAnswer('email', email);

      await API.logEvent(sessionId, 'lead_submitted', {
        step_number: 20,
        step_name: 'lead_form',
        time_on_step: State.getTimeOnCurrentScreen(),
      });

      redirectToVSL();
    });

    setTimeout(() => emailInput.focus(), 100);
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


  // ============================================
  // PRIVREMENI PLACEHOLDER
  // ============================================

  function showPlaceholder(message) {
    const html = `
      <h2 class="screen__title">${message}</h2>
      <p class="screen__subtitle">
        <strong>Session ID:</strong> <code style="font-size: 11px;">${State.getSessionId()}</code><br><br>
        <strong>Trenutni odgovori:</strong>
      </p>
      <pre style="background: #f5f5fa; padding: 16px; border-radius: 12px; font-size: 12px; overflow-x: auto;">${JSON.stringify(State.getAllAnswers(), null, 2)}</pre>
    `;
    setScreen(html, 'placeholder', 2);
  }


  return {
    init,
  };

})();


// ============================================
// START
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  Quiz.init();
});

console.log('[quiz.js] učitan');
