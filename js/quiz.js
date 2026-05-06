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

    // Idi na prvi screen — Gender selection
    showGender();
  }


  // ============================================
  // SCREEN RENDERING (univerzalna funkcija)
  // ============================================

  function setScreen(html, screenName, screenNumber = null, opts = {}) {
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
      // Custom back handler ili default (nazad na prethodni screen iz history-ja)
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

    // Pozovi funkciju za taj screen sa flag-om da ne dodaje u history
    showScreenByName(targetScreen, { isBackNavigation: true });
  }


  /**
   * Pomoćna funkcija - poziva show* funkciju po imenu screen-a
   * @param {object} opts - prosleđuje se setScreen-u (npr. isBackNavigation)
   */
  function showScreenByName(screenName, opts = {}) {
    // Privremeno čuvamo opts u modulu da setScreen može da ih pročita
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
      edu_block: () => showEduBlock(),    // ← novi red
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
  // SCREEN: GENDER SELECTION
  // ============================================

  function showGender() {
    const html = `
      <h2 class="screen__title">Izaberi svoj pol</h2>
      <p class="screen__subtitle">Da bismo ti pružili tačnije rezultate.</p>

      <div class="gender-grid">
        <button class="gender-card" data-gender="female">
          <div class="gender-card__label">Žensko</div>
          <div class="gender-card__arrow">→</div>
        </button>
        <button class="gender-card" data-gender="male">
          <div class="gender-card__label">Muško</div>
          <div class="gender-card__arrow">→</div>
        </button>
      </div>
    `;

    // Prvi screen — bez back dugmeta (4. parametar = null)
    setScreen(html, 'gender', 1, { hideBack: true });

    document.querySelectorAll('.gender-card').forEach(card => {
      card.addEventListener('click', () => handleGenderSelect(card.dataset.gender));
    });
  }


  async function handleGenderSelect(gender) {
    State.setAnswer('gender', gender);

    // Loguj completion + update sesiju
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

    // Idi na sledeći — TODO: pain location
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

    // Back vodi na gender screen
    setScreen(html, 'pain_location', 2);

    // Auto-next na klik
    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.querySelectorAll('.option').forEach(o => o.disabled = true);

        setTimeout(() => {
          handlePainLocationSelect(opt.dataset.location);
        }, 300);
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

    // Prikaži zaključak sa procentom
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

    const html = `
      <div class="conclusion">
        <div class="conclusion__icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20"></path>
            <path d="M8 5h8"></path>
            <path d="M7 9h10"></path>
            <path d="M7 13h10"></path>
            <path d="M8 17h8"></path>
            <path d="M9 21h6"></path>
          </svg>
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

    // Back vodi na pain location izbor
    setScreen(html, 'pain_location_conclusion', 3);

    document.getElementById('continueBtn').addEventListener('click', () => {
      showPainRadiates();
    });
  }

// ============================================
  // SCREEN: PAIN RADIATES (DA/NE → diagnosis)
  // ============================================

  function showPainRadiates() {
    const painLocation = State.getAnswer('pain_location');
    // Vrat i srednja leđa = ruka, donja leđa = noga
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

    // Auto-next na klik
    document.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.querySelectorAll('.option').forEach(o => o.disabled = true);

        setTimeout(() => {
          // 'true'/'false' string iz dataset-a → boolean
          const radiates = opt.dataset.radiates === 'true';
          handlePainRadiatesSelect(radiates);
        }, 300);
      });
    });
  }


  async function handlePainRadiatesSelect(radiates) {
    State.setAnswer('pain_radiates', radiates);
    // diagnosis se automatski postavlja kroz state.js (pain_radiates → diagnosis)
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

    // Idi na sledeći — TODO: pain frequency (A/B/C)
    showAbcQuestion('pain_frequency', 5, () => showPainRadiates());
  }

// ============================================
  // UNIVERZALNI A/B/C SCREEN
  // Koristi Questions config za bilo koje A/B/C pitanje
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

    // Auto-next na klik
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
        }, 300);
      });
    });
  }


  async function handleAbcSelect(questionKey, screenNumber, answer) {
    State.setAnswer(questionKey, answer);

    const timeOnStep = State.getTimeOnCurrentScreen();
    const sessionId = State.getSessionId();

    // Update sesije — odgovor ide u `answers` JSONB polje
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

    // Idi na sledeće pitanje na osnovu trenutnog
    routeNextAbc(questionKey);
  }


  /**
   * Routes na sledeći screen na osnovu trenutnog pitanja
   * Redosled: pain_frequency → pain_description → pain_scale (TODO) → ...
   */
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
      <h2 class="screen__title">Koliko jak je bol?</h2>
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

    // Update vizuelne pozadine slidera (gradient od zelene do crvene)
    function updateSliderBg(value) {
      const percentage = ((value - 1) / 9) * 100;
      slider.style.setProperty('--scale-progress', `${percentage}%`);

      // Boja vrednosti se menja
      let color;
      if (value <= 3) color = '#10b981';      // zelena
      else if (value <= 6) color = '#f59e0b'; // žuta/narandžasta
      else color = '#ef4444';                  // crvena

      valueDisplay.style.color = color;
    }

    updateSliderBg(initialValue);

    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      valueDisplay.textContent = value;
      updateSliderBg(value);

      // Aktiviraj NASTAVI tek kad korisnik prvi put pomeri slider
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
  // SCREEN: PAIN DURATION (koliko dugo traje bol)
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

    // Auto-next na klik
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
        }, 300);
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
  // SCREEN: MID CONCLUSION (zaključak posle prvog dela kviza)
  // ============================================

  // ============================================
  // SCREEN: MID CONCLUSION (zaključak posle prvog dela kviza)
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
      showAbcQuestion('pain_when', 10);
    });
  }

// ============================================
  // SCREEN: GOALS (multi-select 6 ciljeva)
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

    const optionsHtml = goalsList.map((goal, idx) => {
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

        // Aktiviraj NASTAVI ako je bar jedna selektovana
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
  // SCREEN: EDU BLOK (slideshow sa 4 slajda)
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
    const isLast = slideIndex === eduSlides.length - 1;
    const isPositive = slide.type === 'positive';

    // Set body class odmah (sprečava flash bele pozadine)
    document.body.className = isPositive ? 'edu-bg-positive' : 'edu-bg-warning';

    // Ako već postoji edu-slide u DOM-u (prelazak između slide-ova),
    // animiraj sadržaj umesto da rerendaš ceo screen
    const existingSlide = document.querySelector('.edu-slide');

    if (existingSlide && State.getCurrentScreen() === 'edu_block') {
      // Tranzicija unutar slideshow-a (slide 1 → 2 → 3 → 4)
      animateEduSlideContent(slideIndex);
      return;
    }

    // Prvi ulazak u edu (sa Goals screen-a) — pravi pun render
    renderEduSlide(slideIndex);
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

    const html = `
      <div class="edu-slide ${isPositive ? 'edu-slide--positive' : 'edu-slide--warning'}">
        <div class="edu-slide__dots">${dotsHtml}</div>

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

    document.getElementById('continueBtn').addEventListener('click', () => {
      if (isLast) {
        showCalculating();
      } else {
        showEduBlock(slideIndex + 1);
      }
    });
  }


  function animateEduSlideContent(slideIndex) {
    const slide = eduSlides[slideIndex];
    const isLast = slideIndex === eduSlides.length - 1;
    const isPositive = slide.type === 'positive';

    const eduSlideEl = document.querySelector('.edu-slide');
    const contentEl = document.getElementById('eduContent');
    const dotsContainer = document.querySelector('.edu-slide__dots');
    const continueBtn = document.getElementById('continueBtn');

    // Update klasa za boju pozadine
    eduSlideEl.classList.remove('edu-slide--warning', 'edu-slide--positive');
    eduSlideEl.classList.add(isPositive ? 'edu-slide--positive' : 'edu-slide--warning');

    // Fade-out trenutnog sadržaja
    contentEl.style.opacity = '0';
    contentEl.style.transform = 'translateY(8px)';

    setTimeout(() => {
      // Update dot indicators
      const dots = dotsContainer.querySelectorAll('.edu-dot');
      dots.forEach((dot, idx) => {
        dot.classList.remove('edu-dot--active', 'edu-dot--passed');
        if (idx === slideIndex) dot.classList.add('edu-dot--active');
        else if (idx < slideIndex) dot.classList.add('edu-dot--passed');
      });

      // Update sadržaj
      const iconSvg = getEduIcon(slide.icon);
      const textHtml = slide.text ? `<p class="edu-slide__text">${slide.text}</p>` : '';
      contentEl.innerHTML = `
        <div class="edu-slide__icon">${iconSvg}</div>
        <h2 class="edu-slide__heading">${slide.heading}</h2>
        ${textHtml}
      `;

      // Update dugme
      continueBtn.textContent = isLast ? 'NASTAVI ›' : 'DALJE ›';

      // Re-bind klik (jer setScreen je već prošao)
      const newBtn = continueBtn.cloneNode(true);
      continueBtn.parentNode.replaceChild(newBtn, continueBtn);
      newBtn.addEventListener('click', () => {
        if (isLast) {
          showCalculating();
        } else {
          showEduBlock(slideIndex + 1);
        }
      });

      // Fade-in novog sadržaja
      contentEl.style.opacity = '1';
      contentEl.style.transform = 'translateY(0)';
    }, 200);
  }


  function getEduIcon(iconType) {
    const icons = {
      goals: `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>`,
      spread: `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
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
  // SCREEN: CALCULATING ANIMACIJA (3 sek 0% → 100%)
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
            <!-- Background circle -->
            <circle
              cx="100" cy="100" r="88"
              fill="none"
              stroke="rgba(22, 162, 157, 0.15)"
              stroke-width="10"
            />
            <!-- Progress circle (rotates) -->
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

    const DURATION = 3000; // 3 sekunde
    const CIRCUMFERENCE = 552.92; // 2 * π * 88

    let startTime = null;
    let messageIndex = 0;
    let lastMessageChange = 0;
    const MESSAGE_INTERVAL = 750; // promena teksta na 750ms

    // Loguj 'step_viewed' za calculating
    API.logEvent(State.getSessionId(), 'step_viewed', {
      step_number: 19,
      step_name: 'calculating',
    });

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / DURATION, 1);

      // Update procenat (sa easing da deluje prirodnije)
      const easedProgress = easeOutCubic(progress);
      const percentage = Math.round(easedProgress * 100);
      percentageEl.textContent = `${percentage}%`;

      // Update kružni progress
      const offset = CIRCUMFERENCE * (1 - easedProgress);
      circleEl.style.strokeDashoffset = offset;

      // Update poruke
      if (elapsed - lastMessageChange >= MESSAGE_INTERVAL && messageIndex < messages.length - 1) {
        messageIndex++;
        lastMessageChange = elapsed;
        // Fade-out → change → fade-in
        messageEl.style.opacity = '0';
        setTimeout(() => {
          messageEl.textContent = messages[messageIndex];
          messageEl.style.opacity = '1';
        }, 150);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animacija završena → idi na lead formu posle kratke pauze
        setTimeout(() => {
          showLeadForm();
        }, 500);
      }
    }

    // Easing function (cubic ease-out)
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    requestAnimationFrame(animate);
  }

// ============================================
  // SCREEN: LEAD FORM (ime + email)
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

    // Email validacija
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

    // Mapiranje dijagnoze na URL putanju
    const VSL_PATHS = {
      muscle: '/misicni-bol',
      hernia: '/diskus-hernija',
    };

    const path = VSL_PATHS[diagnosis] || VSL_PATHS.muscle;

    // Koristi trenutni origin (radi i na staging-u i na produkciji)
    // Sa lokomoto.webflow.io → ide na lokomoto.webflow.io/misicni-bol
    // Sa kviz.lokomoto.rs → ide na kviz.lokomoto.rs/misicni-bol
    const baseUrl = `${window.location.origin}${path}`;

    // Parametri za Pain Profile karticu
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
  // PRIVREMENI PLACEHOLDER (dok ne napravimo sve screen-ove)
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