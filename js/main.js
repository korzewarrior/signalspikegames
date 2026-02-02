/**
 * Signal Spike Games — Main JS
 * Minimal, functional, no fluff
 */

(function() {
    'use strict';

    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close nav when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });

        // Close nav when clicking outside
        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navToggle.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    }

    // Smooth scroll for anchor links (fallback for older browsers)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Lightbox for game page images
    const lightboxImages = document.querySelectorAll('[data-lightbox]');
    
    if (lightboxImages.length > 0) {
        let currentIndex = 0;
        const images = Array.from(lightboxImages);

        // Create lightbox elements
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <button class="lightbox-close" aria-label="Close">&times;</button>
            <button class="lightbox-prev" aria-label="Previous">&#8249;</button>
            <img class="lightbox-img" src="" alt="">
            <button class="lightbox-next" aria-label="Next">&#8250;</button>
            <div class="lightbox-counter"></div>
        `;
        document.body.appendChild(lightbox);

        const lightboxImg = lightbox.querySelector('.lightbox-img');
        const lightboxClose = lightbox.querySelector('.lightbox-close');
        const lightboxPrev = lightbox.querySelector('.lightbox-prev');
        const lightboxNext = lightbox.querySelector('.lightbox-next');
        const lightboxCounter = lightbox.querySelector('.lightbox-counter');

        // Update lightbox display
        function showImage(index) {
            currentIndex = index;
            const img = images[index];
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt;
            lightboxCounter.textContent = `${index + 1} / ${images.length}`;
            
            // Hide nav if only one image
            if (images.length <= 1) {
                lightboxPrev.style.display = 'none';
                lightboxNext.style.display = 'none';
                lightboxCounter.style.display = 'none';
            } else {
                lightboxPrev.style.display = '';
                lightboxNext.style.display = '';
                lightboxCounter.style.display = '';
            }
        }

        function nextImage() {
            showImage((currentIndex + 1) % images.length);
        }

        function prevImage() {
            showImage((currentIndex - 1 + images.length) % images.length);
        }

        // Open lightbox
        images.forEach((img, index) => {
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', () => {
                showImage(index);
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });

        // Close lightbox
        function closeLightbox() {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }

        lightboxClose.addEventListener('click', closeLightbox);
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            prevImage();
        });
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            nextImage();
        });
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;
            
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        });
    }

    // Character modal
    const characterCards = document.querySelectorAll('.character-card');
    const characterModal = document.getElementById('characterModal');
    
    if (characterCards.length > 0 && characterModal) {
        const modalImg = document.getElementById('modalImg');
        const modalName = document.getElementById('modalName');
        const modalBio = document.getElementById('modalBio');
        const modalClose = characterModal.querySelector('.character-modal-close');

        // Character data - edit bios here
        const characterData = {
            arcadia: {
                name: 'Arcadia',
                bio: 'A natural leader with an unshakeable sense of justice. Arcadia fights to protect those who cannot protect themselves.'
            },
            antheia: {
                name: 'Antheia',
                bio: 'Graceful and swift, Antheia moves like the wind. Her agility makes her nearly impossible to pin down.'
            },
            athena: {
                name: 'Athena',
                bio: 'The strategist of the group. Athena approaches every battle with a plan and always stays three steps ahead.'
            },
            astraea: {
                name: 'Astraea',
                bio: 'Guided by the stars, Astraea brings balance to chaos. Her cosmic intuition is unmatched.'
            },
            apollo: {
                name: 'Apollo',
                bio: 'Radiant and confident, Apollo lights up every arena. His precision and timing are legendary.'
            },
            artemis: {
                name: 'Artemis',
                bio: 'A lone hunter who thrives in the shadows. Artemis strikes from unexpected angles with deadly accuracy.'
            },
            asteria: {
                name: 'Asteria',
                bio: 'Born from stardust, Asteria harnesses celestial energy. Her powers grow stronger under the night sky.'
            },
            atlas: {
                name: 'Atlas',
                bio: 'The immovable force. Atlas can take hits that would flatten anyone else and keep on fighting.'
            },
            ares: {
                name: 'Ares',
                bio: 'Pure aggression channeled into combat. Ares lives for the thrill of battle and never backs down.'
            },
            aether: {
                name: 'Aether',
                bio: 'Mysterious and ethereal, Aether phases between dimensions. Now you see them, now you don\'t.'
            },
            aion: {
                name: 'Aion',
                bio: 'Master of time itself. Aion bends moments to their will, creating openings where none existed.'
            },
            alastor: {
                name: 'Alastor',
                bio: 'The wild card. Unpredictable and relentless, Alastor keeps opponents guessing until it\'s too late.'
            }
        };

        function openCharacterModal(characterId) {
            const card = document.querySelector(`[data-character="${characterId}"]`);
            const data = characterData[characterId];
            
            if (card && data) {
                modalImg.src = card.querySelector('img').src;
                modalImg.alt = data.name;
                modalName.textContent = data.name;
                modalBio.textContent = data.bio;
                characterModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }

        function closeCharacterModal() {
            characterModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        characterCards.forEach(card => {
            card.addEventListener('click', () => {
                openCharacterModal(card.dataset.character);
            });
        });

        modalClose.addEventListener('click', closeCharacterModal);
        characterModal.addEventListener('click', (e) => {
            if (e.target === characterModal) closeCharacterModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && characterModal.classList.contains('active')) {
                closeCharacterModal();
            }
        });
    }

})();
