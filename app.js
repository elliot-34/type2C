const API_URL = "https://type2-proxy.serviceapi.workers.dev/?hedef=kuafor";
const TUM_SAATLER = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

let mevcutRandevular = [];

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- YENİ: MOBİL HAMBURGER MENÜ MANTIĞI ---
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (mobileBtn && mobileMenu) {
        mobileBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('is-active');
        });
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('is-active');
            });
        });
    }
    // ------------------------------------------

    initServicesCarousel(); 
    initPhoneMask();
    await API_Baglantisini_Kur();
    initAppointmentForm();
});

function initServicesCarousel() {
    const track = document.querySelector('.services-track');
    const cards = document.querySelectorAll('.service-card');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (!track || cards.length === 0 || !prevBtn || !nextBtn) return;

    let currentIndex = 0;

    const updateCarousel = () => {
        const cardWidth = cards[0].getBoundingClientRect().width;
        const gap = parseFloat(window.getComputedStyle(track).gap) || 32;
        const moveAmount = cardWidth + gap;
        const viewportWidth = document.querySelector('.carousel-viewport').offsetWidth;
        const visibleCards = Math.floor((viewportWidth + gap) / moveAmount) || 1; 
        const maxIndex = Math.max(0, cards.length - visibleCards);
        
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        if (currentIndex < 0) currentIndex = 0;
        
        track.style.transform = `translateX(-${currentIndex * moveAmount}px)`;
        
        prevBtn.style.opacity = currentIndex === 0 ? "0.3" : "1";
        prevBtn.style.cursor = currentIndex === 0 ? "default" : "pointer";
        nextBtn.style.opacity = currentIndex >= maxIndex ? "0.3" : "1";
        nextBtn.style.cursor = currentIndex >= maxIndex ? "default" : "pointer";
    };

    nextBtn.addEventListener('click', () => { currentIndex++; updateCarousel(); });
    prevBtn.addEventListener('click', () => { currentIndex--; updateCarousel(); });
    window.addEventListener('resize', updateCarousel);
    
    let touchStartX = 0;
    let touchEndX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    track.addEventListener('touchend', e => { 
        touchEndX = e.changedTouches[0].screenX; 
        const swipeDist = touchEndX - touchStartX;
        if (swipeDist < -50) { currentIndex++; updateCarousel(); }
        else if (swipeDist > 50) { currentIndex--; updateCarousel(); }
    }, { passive: true });

    setTimeout(updateCarousel, 100);
}

async function API_Baglantisini_Kur() {
    const tarihInput = document.getElementById('form-date');
    const saatSelect = document.getElementById('form-time');

    try {
        const guncelUrl = API_URL + "&nocache=" + new Date().getTime();
        const response = await fetch(guncelUrl);
        mevcutRandevular = await response.json();
        
        tarihInput.disabled = false;
        tarihInput.placeholder = "Tarih seçmek için tıklayın";
        tarihInput.classList.remove('disabled:bg-gray-100', 'disabled:cursor-wait');
        
        initFlatpickr(tarihInput);
    } catch (error) { 
        console.error("API Bağlantı Hatası:", error); 
        saatSelect.innerHTML = '<option value="">Sunucu hatası! Sayfayı yenileyin.</option>';
    }
}

function initFlatpickr(inputElement) {
    flatpickr(inputElement, {
        locale: "tr", 
        minDate: "today", 
        dateFormat: "Y-m-d",  
        monthSelectorType: "static", 
        onReady: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 0) instance.calendarContainer.classList.add('ilk-acilis');
            dinamikHaftaAyari(instance);
        },
        onOpen: function(selectedDates, dateStr, instance) { setTimeout(() => dinamikHaftaAyari(instance), 0); },
        onChange: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.remove('ilk-acilis');
            saatleriFiltrele(dateStr); 
            const group = document.getElementById('form-date').closest('.form-group');
            if(group) group.classList.remove('is-invalid');
        },
        onMonthChange: function(selectedDates, dateStr, instance) { dinamikHaftaAyari(instance); },
        onYearChange: function(selectedDates, dateStr, instance) { dinamikHaftaAyari(instance); }
    });
}

function dinamikHaftaAyari(instance) {
    const days = instance.days.childNodes;
    if (days.length === 0) return;
    let altinciHaftaBos = true;
    for(let i=35; i<42; i++) { if(days[i] && !days[i].classList.contains('nextMonthDay')) { altinciHaftaBos = false; break; } }
    for(let i=35; i<42; i++) { if(days[i]) days[i].style.display = altinciHaftaBos ? 'none' : 'inline-block'; }
    let besinciHaftaBos = true;
    for(let i=28; i<35; i++) { if(days[i] && !days[i].classList.contains('nextMonthDay')) { besinciHaftaBos = false; break; } }
    for(let i=28; i<35; i++) { if(days[i]) days[i].style.display = besinciHaftaBos ? 'none' : 'inline-block'; }
}

function saatleriFiltrele(secilenTarih) {
    const uzmanSelect = document.getElementById('form-expert');
    const saatSelect = document.getElementById('form-time');
    const secilenUzman = uzmanSelect.value;
    
    if (!secilenTarih || !secilenUzman) {
        saatSelect.innerHTML = '<option value="" disabled selected>Önce tarih ve uzman seçiniz</option>';
        saatSelect.disabled = true;
        return;
    }

    const simdi = new Date();
    const bugunStr = `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, '0')}-${String(simdi.getDate()).padStart(2, '0')}`;
    const bugunMu = (secilenTarih === bugunStr);
    const anlikSaat = simdi.getHours();
    const anlikDakika = simdi.getMinutes();

    const doluSaatler = mevcutRandevular.filter(r => {
        let satirUzman = r.uzman ? String(r.uzman).trim() : "";
        let arananUzman = String(secilenUzman).trim();
        let satirTarihi = String(r.tarih).replace(/'/g, '').trim();
        if (satirTarihi.includes('T')) {
            const dateObj = new Date(satirTarihi);
            satirTarihi = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        } else { satirTarihi = satirTarihi.substring(0, 10); }
        return satirTarihi === secilenTarih && satirUzman === arananUzman;
    }).map(r => {
        let satirSaati = String(r.saat).replace(/'/g, '').trim();
        if (satirSaati.includes('T')) {
            const timeObj = new Date(satirSaati);
            satirSaati = `${String(timeObj.getHours()).padStart(2, '0')}:${String(timeObj.getMinutes()).padStart(2, '0')}`;
        } else {
            let timeParts = satirSaati.split(':');
            if (timeParts.length >= 2) satirSaati = timeParts[0].padStart(2, '0') + ':' + timeParts[1].substring(0,2).padStart(2, '0');
        }
        return satirSaati;
    });

    saatSelect.innerHTML = '<option value="" selected>Saat seçiniz...</option>';
    saatSelect.disabled = false;

    let bosSaatVar = false;
    TUM_SAATLER.forEach(saat => {
        let gecmisMi = false;
        if (bugunMu) {
            const parcalar = saat.split(':');
            const dilimSaat = parseInt(parcalar[0], 10);
            const dilimDakika = parseInt(parcalar[1], 10);
            if (dilimSaat < anlikSaat || (dilimSaat === anlikSaat && dilimDakika <= anlikDakika)) gecmisMi = true;
        }
        if (!doluSaatler.includes(saat) && !gecmisMi) {
            const option = document.createElement('option');
            option.value = saat;
            option.textContent = saat;
            saatSelect.appendChild(option);
            bosSaatVar = true;
        }
    });

    if (!bosSaatVar) {
        saatSelect.innerHTML = '<option value="" disabled selected>Bu uzman için boş saat yok</option>';
        saatSelect.disabled = true;
    }
}

document.getElementById('form-expert').addEventListener('change', function() {
    const secilenTarih = document.getElementById('form-date').value;
    if (secilenTarih) { saatleriFiltrele(secilenTarih); }
});

function initAppointmentForm() {
    const form = document.getElementById('appointment-form');
    const successContainer = document.getElementById('form-success');
    const resetBtn = document.getElementById('btn-reset-form');

    if (!form || !successContainer || !resetBtn) return;

    const showError = (inputElement) => { const group = inputElement.closest('.form-group'); if (group) group.classList.add('is-invalid'); };
    const clearError = (inputElement) => { const group = inputElement.closest('.form-group'); if (group) group.classList.remove('is-invalid'); };
    const isValidPhone = (phone) => { const digits = phone.replace(/\D/g, ''); return digits.length === 12 && digits.startsWith('90'); };

    const validateField = (input) => {
        const value = input.value.trim();
        if (input.hasAttribute('required') && (!value || value === '')) { showError(input); return false; }
        if (input.type === 'tel' && value) { if (!isValidPhone(value)) { showError(input); return false; } }
        clearError(input); return true;
    };

    const validateForm = () => {
        let isFormValid = true;
        form.querySelectorAll('input, select').forEach(input => { if (!validateField(input)) isFormValid = false; });
        return isFormValid;
    };

    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', () => { if (input.closest('.form-group').classList.contains('is-invalid')) validateField(input); });
        input.addEventListener('change', () => validateField(input));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (validateForm()) {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Gönderiliyor...';
            submitBtn.disabled = true;

            const secilenTarih = document.getElementById('form-date').value;
            const secilenSaat = document.getElementById('form-time').value;
            const secilenUzman = document.getElementById('form-expert').value;

            const yeniRandevu = {
                tarih: "'" + secilenTarih,
                saat: "'" + secilenSaat,
                adSoyad: document.getElementById('form-name').value.trim(),
                telefon: "'" + document.getElementById('form-phone').value.trim(),
                hizmet: document.getElementById('form-service').value,
                uzman: secilenUzman
            };

            try {
                await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(yeniRandevu)
                });

                mevcutRandevular.push({ tarih: secilenTarih, saat: secilenSaat, uzman: secilenUzman });

                successContainer.classList.add('is-active');
                form.reset();
                
                const tarihInput = document.getElementById('form-date');
                if (tarihInput._flatpickr) {
                    tarihInput._flatpickr.clear();
                    tarihInput._flatpickr.calendarContainer.classList.add('ilk-acilis');
                }
                
                const saatSelect = document.getElementById('form-time');
                saatSelect.disabled = true;
                saatSelect.innerHTML = '<option value="" disabled selected>Sistem hazırlanıyor...</option>';

            } catch (error) {
                alert('Bağlantı hatası: Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
            } finally {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        } else {
            const firstError = form.querySelector('.form-group.is-invalid');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    resetBtn.addEventListener('click', () => {
        successContainer.classList.remove('is-active');
        document.getElementById('form-time').innerHTML = '<option value="" disabled selected>Önce tarih ve uzman seçiniz</option>';
        
        // TAKVİM SIFIRLANIRKEN TETİKLENEN SAHTE HATALARI (KIRMIZILIKLARI) TEMİZLE
        document.querySelectorAll('.form-group.is-invalid').forEach(group => {
            group.classList.remove('is-invalid');
        });
        
        // Varsa toplu hata mesajı div'ini de gizle
        const feedbackDiv = document.getElementById('validation-feedback');
        if (feedbackDiv) feedbackDiv.style.display = 'none';
    });
}

function initPhoneMask() {
    const phoneInput = document.getElementById('form-phone');
    if (!phoneInput) return;

    const formatPhone = (value) => {
        let digits = value.replace(/\D/g, '');
        if (digits.startsWith('90')) digits = digits.slice(2);
        if (digits.startsWith('0')) digits = digits.slice(1);

        let formatted = '+90 ';
        if (digits.length > 0) formatted += digits.substring(0, 3);
        if (digits.length > 3) formatted += ' ' + digits.substring(3, 6);
        if (digits.length > 6) formatted += ' ' + digits.substring(6, 8);
        if (digits.length > 8) formatted += ' ' + digits.substring(8, 10);
        return formatted;
    };

    if (!phoneInput.value || phoneInput.value.trim() === '' || phoneInput.value === '+90') {
        phoneInput.value = '+90 ';
    }

    phoneInput.addEventListener('input', (e) => {
        const cursorPosition = phoneInput.selectionStart;
        const previousLength = phoneInput.value.length;
        
        let formatted = formatPhone(phoneInput.value);
        phoneInput.value = formatted;
        
        let newCursorPos = cursorPosition + (formatted.length - previousLength);
        if (newCursorPos < 5) newCursorPos = 5;
        phoneInput.setSelectionRange(newCursorPos, newCursorPos);
    });

    phoneInput.addEventListener('focus', () => {
        if (!phoneInput.value || phoneInput.value === '') phoneInput.value = '+90 ';
    });
}