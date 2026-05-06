// ============================================
// QUESTIONS CONFIG
// Sva A/B/C pitanja za sve 4 sekvence (pol × lokacija)
// ============================================

const Questions = (function() {

  // ============================================
  // POMOĆNE FUNKCIJE
  // ============================================

  /**
   * Vraća ključ sekvence na osnovu state-a
   * Npr. female + lower → 'female_lower'
   */
  function getSequenceKey() {
    const gender = State.getAnswer('gender');
    const location = State.getAnswer('pain_location');

    // Vrat i srednja leđa idu na 'upper' (A/B sekvenca)
    // Donja leđa ide na 'lower' (C sekvenca)
    const locationGroup = location === 'lower' ? 'lower' : 'upper';
    return `${gender}_${locationGroup}`;
  }


  // ============================================
  // SVA PITANJA — organizovana po sekvencama
  // Svako pitanje ima 4 varijante (po jednu za svaku sekvencu)
  // ============================================

  const questions = {

    // -------------------------------------------------
    // 1. Pain Frequency (Koliko često osećaš bol?)
    // Isti tekst za sve sekvence
    // -------------------------------------------------
    pain_frequency: {
      title: 'Koliko često osećaš bol?',
      subtitle: null,
      options: [
        { value: 'A', text: 'Skoro svaki dan, ali slabijeg intenziteta' },
        { value: 'B', text: 'Povremeno, ali kad krene jako udara i traje danima' },
        { value: 'C', text: 'Nekad se pojavi, nekad potpuno nestane' },
      ],
    },

    // -------------------------------------------------
    // 2. Pain Description (Kako bi opisao/la bol?)
    // Tekst zavisi od pola i lokacije
    // -------------------------------------------------
    pain_description: {
      title: {
        female_upper: 'Kako bi opisala bol?',
        male_upper: 'Kako bi opisao bol?',
        female_lower: 'Kako bi opisala bol?',
        male_lower: 'Kako bi opisao bol?',
      },
      options: {
        female_upper: [
          { value: 'A', text: 'Tupa, stalna nelagodnost, kao da me nešto zateže' },
          { value: 'B', text: 'Oštar bol, kao da probada ili se spušta niz ruku' },
          { value: 'C', text: 'Nekad boli, nekad ne, kao težina u vratu, zavisi kako sedim, spavam i slično' },
        ],
        male_upper: [
          { value: 'A', text: 'Tup, stalan osećaj nelagodnosti, kao da me nešto zateže' },
          { value: 'B', text: 'Oštar bol, kao da probada ili se spušta niz ruku' },
          { value: 'C', text: 'Nekad boli, nekad ne, kao težina u vratu, zavisi kako sedim, spavam i slično' },
        ],
        female_lower: [
          { value: 'A', text: 'Tupa, stalna nelagodnost, kao da me nešto zateže' },
          { value: 'B', text: 'Oštar bol, kao da probada ili se spušta niz nogu' },
          { value: 'C', text: 'Nekad boli, nekad ne, kao težina u leđima — zavisi kako sedim, spavam i slično' },
        ],
        male_lower: [
          { value: 'A', text: 'Tupa, stalna nelagodnost, kao da me nešto zateže' },
          { value: 'B', text: 'Oštar bol, kao da probada ili se spušta niz nogu' },
          { value: 'C', text: 'Nekad boli, nekad ne, kao težina u leđima — zavisi kako sedim, spavam i slično' },
        ],
      },
    },

    // -------------------------------------------------
    // 3. Pain When (Kada te najviše boli?)
    // -------------------------------------------------
    pain_when: {
      title: 'Kada te najviše boli?',
      options: {
        female_upper: [
          { value: 'A', text: 'Posle dugog sedenja za računarom ili gledanja u telefon' },
          { value: 'B', text: 'Kada podignem nešto teško' },
          { value: 'C', text: 'Ujutru čim ustanem iz kreveta' },
        ],
        male_upper: [
          { value: 'A', text: 'Posle dugog sedenja za računarom ili gledanja u telefon' },
          { value: 'B', text: 'Kada podignem nešto teško' },
          { value: 'C', text: 'Ujutru čim ustanem iz kreveta' },
        ],
        female_lower: [
          { value: 'A', text: 'Posle dugog sedenja ili stajanja' },
          { value: 'B', text: 'Kad se saginjem ili naglo okrenem' },
          { value: 'C', text: 'Ujutru čim ustanem iz kreveta' },
        ],
        male_lower: [
          { value: 'A', text: 'Posle dugog sedenja ili stajanja' },
          { value: 'B', text: 'Kad se saginjem ili naglo okrenem' },
          { value: 'C', text: 'Ujutru čim ustanem iz kreveta' },
        ],
      },
    },

    // -------------------------------------------------
    // 4. Pain Trigger (Kada ti bol prvi put krene, šta ti je obično okidač?)
    // -------------------------------------------------
    pain_trigger: {
      title: 'Kada ti bol prvi put krene, šta ti je obično okidač?',
      options: {
        female_upper: [
          { value: 'A', text: 'Posle treninga, nošenja tereta ili dužeg naprezanja' },
          { value: 'B', text: 'Kada naglo okrenem glavu ili se nezgodno pomerim' },
          { value: 'C', text: 'Posle dugog gledanja u ekran bez pauze' },
        ],
        male_upper: [
          { value: 'A', text: 'Posle treninga, nošenja tereta ili dužeg naprezanja' },
          { value: 'B', text: 'Kada naglo okrenem glavu ili se nezgodno pomerim' },
          { value: 'C', text: 'Posle dugog gledanja u ekran bez pauze' },
        ],
        female_lower: [
          { value: 'A', text: 'Posle treninga ili fizičkog rada' },
          { value: 'B', text: 'Kad naglo podignem nešto teško ili se iskrivim' },
          { value: 'C', text: 'Posle dugog sedenja ili stajanja' },
        ],
        male_lower: [
          { value: 'A', text: 'Posle treninga ili fizičkog rada' },
          { value: 'B', text: 'Kad naglo podignem nešto teško ili se iskrivim' },
          { value: 'C', text: 'Posle dugog sedenja ili stajanja' },
        ],
      },
    },

    // -------------------------------------------------
    // 5. What Helps (Šta ti obično pomogne?)
    // -------------------------------------------------
    what_helps: {
      title: 'Šta ti obično pomogne?',
      options: {
        female_upper: [
          { value: 'A', text: 'Kada se istegnem ili malo razmrdam vrat, odmah mi bude lakše' },
          { value: 'B', text: 'Samo kada legnem ili nađem neki specijalan položaj' },
          { value: 'C', text: 'Ništa posebno, samo kada pazim na držanje ili promenim jastuk' },
        ],
        male_upper: [
          { value: 'A', text: 'Kada se istegnem ili malo razmrdam vrat, odmah mi bude lakše' },
          { value: 'B', text: 'Samo kada legnem ili nađem neki specijalan položaj' },
          { value: 'C', text: 'Ništa posebno, samo kada pazim na držanje ili promenim jastuk' },
        ],
        female_lower: [
          { value: 'A', text: 'Kad se razgibam ili istegnem, odmah mi bude lakše' },
          { value: 'B', text: 'Samo kada legnem ili nađem neki specijalan položaj' },
          { value: 'C', text: 'Ništa posebno, samo kad pazim da sedim ili spavam bolje' },
        ],
        male_lower: [
          { value: 'A', text: 'Kad se razgibam ili istegnem, odmah mi bude lakše' },
          { value: 'B', text: 'Samo kada legnem ili nađem neki specijalan položaj' },
          { value: 'C', text: 'Ništa posebno, samo kad pazim da sedim ili spavam bolje' },
        ],
      },
    },

    // -------------------------------------------------
    // 6. Daily Impact (Kako ti bol utiče na svakodnevnicu?)
    // -------------------------------------------------
    daily_impact: {
      title: 'Kako ti bol utiče na svakodnevnicu?',
      options: {
        female_upper: [
          { value: 'A', text: 'Smeta mi, ali mogu da funkcionišem, kao da stalno nosim napetost u vratu' },
          { value: 'B', text: 'Zna da me preseče pa mi poremeti dan, teško okrećem glavu' },
          { value: 'C', text: 'Više nervira nego što boli, kao da me stalno podseća da sedim ili stojim pogrešno' },
        ],
        male_upper: [
          { value: 'A', text: 'Smeta mi, ali mogu da funkcionišem, kao da stalno nosim napetost u vratu' },
          { value: 'B', text: 'Zna da me preseče pa mi poremeti dan, teško okrećem glavu' },
          { value: 'C', text: 'Više nervira nego što boli, kao da me stalno podseća da sedim ili stojim pogrešno' },
        ],
        female_lower: [
          { value: 'A', text: 'Smeta mi, ali mogu da funkcionišem, kao da nosim ranac na leđima non-stop' },
          { value: 'B', text: 'Zna da me preseče pa mi poremeti dan, teško se pomeram' },
          { value: 'C', text: 'Više nervira nego što boli, kao da me stalno podseća da nešto radim pogrešno' },
        ],
        male_lower: [
          { value: 'A', text: 'Smeta mi, ali mogu da funkcionišem, kao da nosim ranac na leđima non-stop' },
          { value: 'B', text: 'Zna da me preseče pa mi poremeti dan, teško se pomeram' },
          { value: 'C', text: 'Više nervira nego što boli, kao da me stalno podseća da nešto radim pogrešno' },
        ],
      },
    },

    // -------------------------------------------------
    // 7. What Worsens (Šta ti najviše pogorša bol?)
    // -------------------------------------------------
    what_worsens: {
      title: 'Šta ti najviše pogorša bol?',
      options: {
        female_upper: [
          { value: 'A', text: 'Dug rad za računarom, vožnja ili gledanje u telefon bez pauze' },
          { value: 'B', text: 'Okretanje glave ili nagli pokreti' },
          { value: 'C', text: 'Nedostatak sna ili stres' },
        ],
        male_upper: [
          { value: 'A', text: 'Dug rad za računarom, vožnja ili gledanje u telefon bez pauze' },
          { value: 'B', text: 'Okretanje glave ili nagli pokreti' },
          { value: 'C', text: 'Nedostatak sna ili stres' },
        ],
        female_lower: [
          { value: 'A', text: 'Kad stojim ili sedim dugo bez pomeranja' },
          { value: 'B', text: 'Savijanje, dizanje stvari ili trčanje' },
          { value: 'C', text: 'Nedostatak sna ili stres' },
        ],
        male_lower: [
          { value: 'A', text: 'Kad stojim ili sedim dugo bez pomeranja' },
          { value: 'B', text: 'Savijanje, dizanje stvari ili trčanje' },
          { value: 'C', text: 'Nedostatak sna ili stres' },
        ],
      },
    },

    // -------------------------------------------------
    // 8. Accompanying Feeling (Kakav osećaj imaš u telu pored bola?)
    // -------------------------------------------------
    accompanying_feeling: {
      title: 'Kakav osećaj imaš u telu pored bola?',
      options: {
        female_upper: [
          { value: 'A', text: 'Ukočenost i zategnutost u vratu i ramenima' },
          { value: 'B', text: 'Trnjenje, peckanje ili slabost u ruci' },
          { value: 'C', text: 'Umor, napetost i osećaj da su mi vrat i ramena zaključani' },
        ],
        male_upper: [
          { value: 'A', text: 'Ukočenost i zategnutost u vratu i ramenima' },
          { value: 'B', text: 'Trnjenje, peckanje ili slabost u ruci' },
          { value: 'C', text: 'Umor, napetost i osećaj da su mi vrat i ramena zaključani' },
        ],
        female_lower: [
          { value: 'A', text: 'Ukočenost i zategnutost u mišićima' },
          { value: 'B', text: 'Trnjenje, peckanje ili slabost u nozi' },
          { value: 'C', text: 'Umor, napetost i osećaj da su mi leđa zaključana' },
        ],
        male_lower: [
          { value: 'A', text: 'Ukočenost i zategnutost u mišićima' },
          { value: 'B', text: 'Trnjenje, peckanje ili slabost u nozi' },
          { value: 'C', text: 'Umor, napetost i osećaj da su mi leđa zaključana' },
        ],
      },
    },

    // -------------------------------------------------
    // 9. Previous Attempts (Da li si ikada probao/la nešto da rešiš problem?)
    // -------------------------------------------------
    previous_attempts: {
      title: {
        female_upper: 'Da li si ikada probala nešto da rešiš problem?',
        male_upper: 'Da li si ikada probao nešto da rešiš problem?',
        female_lower: 'Da li si ikada probala nešto da rešiš problem?',
        male_lower: 'Da li si ikada probao nešto da rešiš problem?',
      },
      options: {
        female_upper: [
          { value: 'A', text: 'Da, vežbe i istezanje pomažu' },
          { value: 'B', text: 'Probala sam, ali ništa posebno ne pomaže osim odmora' },
          { value: 'C', text: 'Iskreno nisam se baš trudila, čekam da samo prođe' },
        ],
        male_upper: [
          { value: 'A', text: 'Da, vežbe i istezanje pomažu' },
          { value: 'B', text: 'Probao sam, ali ništa posebno ne pomaže osim odmora' },
          { value: 'C', text: 'Iskreno nisam se baš trudio, čekam da samo prođe' },
        ],
        female_lower: [
          { value: 'A', text: 'Da, vežbe i istezanje pomažu' },
          { value: 'B', text: 'Probala sam, ali ništa posebno ne pomaže osim odmora' },
          { value: 'C', text: 'Iskreno nisam se baš trudila, čekam da samo prođe' },
        ],
        male_lower: [
          { value: 'A', text: 'Da, vežbe i istezanje pomažu' },
          { value: 'B', text: 'Probao sam, ali ništa posebno ne pomaže osim odmora' },
          { value: 'C', text: 'Iskreno nisam se baš trudio, čekam da samo prođe' },
        ],
      },
    },
  };


  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Vraća pitanje sa kompletnim podacima za trenutnu sekvencu
   * @param {string} questionKey - npr. 'pain_frequency'
   * @returns {{ title: string, subtitle: string|null, options: Array }}
   */
  function get(questionKey) {
    const q = questions[questionKey];
    if (!q) {
      console.error(`[Questions] Pitanje "${questionKey}" ne postoji`);
      return null;
    }

    const sequence = getSequenceKey();

    return {
      title: typeof q.title === 'object' ? q.title[sequence] : q.title,
      subtitle: typeof q.subtitle === 'object' ? q.subtitle?.[sequence] : (q.subtitle || null),
      options: Array.isArray(q.options) ? q.options : q.options[sequence],
    };
  }


  return {
    get,
    getSequenceKey,
  };

})();

console.log('[questions.js] učitan');