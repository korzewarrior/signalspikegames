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

})();
