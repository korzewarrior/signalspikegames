/**
 * Signal Spike Games — Main JS
 * Shared components + interactions
 */

(function() {
    'use strict';

    // ==========================================
    // SHARED COMPONENTS
    // ==========================================

    // Announcement bar + nav
    const headerHTML = `
    <div class="announcement-bar">
        <span class="announcement-badge">2026</span>
        <span>We'll be at <strong>GameOn Expo</strong></span>
        <a href="/gameon-expo/" class="announcement-link">Details</a>
        <a href="https://gameonexpo.com" target="_blank" rel="noopener" class="announcement-link">Event Site <i class="fas fa-external-link-alt"></i></a>
    </div>
    <nav class="nav">
        <div class="nav-inner">
            <a href="/" class="nav-logo">
                SIGNAL<span class="spike">SPIKE</span>
            </a>
            <div class="nav-links" id="navLinks">
                <a href="/" class="nav-link">Home</a>
                <a href="/starboys/" class="nav-link">Starboys</a>
                <a href="/bloodrust/" class="nav-link">Bloodrust</a>
                <a href="/nullonline/" class="nav-link">Null Online</a>
                <a href="/devlog/" class="nav-link">Devlog</a>
            </div>
            <div class="nav-toggle" id="navToggle">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    </nav>`;

    // Footer
    const footerHTML = `
    <footer class="footer">
        <div class="container">
            <div class="footer-inner">
                <div class="footer-social">
                    <a href="https://store.steampowered.com/app/3756250/Starboys/" target="_blank" rel="noopener" class="social-link" aria-label="Steam">
                        <i class="fab fa-steam"></i>
                    </a>
                    <a href="https://discord.gg/GJuGbG2RzB" target="_blank" rel="noopener" class="social-link" aria-label="Discord">
                        <i class="fab fa-discord"></i>
                    </a>
                    <a href="mailto:hello@signalspike.games" class="social-link" aria-label="Email">
                        <i class="fas fa-envelope"></i>
                    </a>
                    <!-- <a href="https://www.twitch.tv/signalspikegames" target="_blank" rel="noopener" class="social-link" aria-label="Twitch">
                        <i class="fab fa-twitch"></i>
                    </a>
                    <a href="https://www.youtube.com/@SignalSpikeGames" target="_blank" rel="noopener" class="social-link" aria-label="YouTube">
                        <i class="fab fa-youtube"></i>
                    </a> -->
                </div>
                <p class="footer-copy">&copy; ${new Date().getFullYear()} Signal Spike Games</p>
                <div class="footer-links">
                    <a href="/about/">About</a>
                    <a href="/faq/">FAQ</a>
                    <a href="/legal/">Legal</a>
                </div>
            </div>
        </div>
    </footer>`;

    // Roadmap
    const roadmapHTML = `
    <section class="roadmap-section">
        <div class="container">
            <p class="roadmap-label">Roadmap</p>
            <div class="roadmap">
                <div class="roadmap-step roadmap-step--done">
                    <div class="roadmap-dot"></div>
                    <h3><a href="/nullonline/">Null Online</a></h3>
                    <span class="roadmap-status">Released</span>
                </div>
                <div class="roadmap-step roadmap-step--active">
                    <div class="roadmap-dot"></div>
                    <h3><a href="/bloodrust/">Bloodrust</a></h3>
                    <span class="roadmap-status">In Development</span>
                </div>
                <div class="roadmap-step roadmap-step--active">
                    <div class="roadmap-dot"></div>
                    <h3><a href="/starboys/">Starboys</a></h3>
                    <span class="roadmap-status">Alpha</span>
                </div>
                <div class="roadmap-step roadmap-step--next">
                    <div class="roadmap-dot"></div>
                    <h3>KNVGHT</h3>
                    <span class="roadmap-status">Up Next</span>
                </div>
                <div class="roadmap-step">
                    <div class="roadmap-dot"></div>
                    <h3>The Magic Ring</h3>
                </div>
                <div class="roadmap-step">
                    <div class="roadmap-dot"></div>
                    <h3>Moonfall</h3>
                </div>
                <div class="roadmap-step">
                    <div class="roadmap-dot"></div>
                    <h3>Wanderer</h3>
                </div>
            </div>
        </div>
    </section>`;

    // Inject shared components
    const siteHeader = document.getElementById('site-header');
    const siteFooter = document.getElementById('site-footer');
    const siteRoadmap = document.getElementById('site-roadmap');

    if (siteHeader) siteHeader.innerHTML = headerHTML;
    if (siteRoadmap) siteRoadmap.innerHTML = roadmapHTML;
    if (siteFooter) siteFooter.innerHTML = footerHTML;

    // ==========================================
    // MOBILE NAV TOGGLE
    // ==========================================

    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });

        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navToggle.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    }

    // ==========================================
    // SMOOTH SCROLL
    // ==========================================

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

    // ==========================================
    // SCREENSHOT GALLERY + LIGHTBOX
    // ==========================================

    const mainScreenshot = document.querySelector('.main-screenshot img');
    const galleryThumbs = document.querySelectorAll('.gallery-thumb');

    if (mainScreenshot && galleryThumbs.length > 0) {
        // Build image list from thumbnails (first thumb = initial main image)
        const allImages = Array.from(galleryThumbs).map(thumb => {
            const img = thumb.querySelector('img');
            return { src: img.src, alt: img.alt };
        });

        let currentIndex = 0;

        function setActiveThumb(index) {
            galleryThumbs.forEach(t => t.classList.remove('gallery-thumb--active'));
            if (galleryThumbs[index]) {
                galleryThumbs[index].classList.add('gallery-thumb--active');
            }
        }

        function showInMain(index) {
            currentIndex = index;
            mainScreenshot.src = allImages[index].src;
            mainScreenshot.alt = allImages[index].alt;
            setActiveThumb(index);
        }

        // Thumbnail click: swap into main image
        galleryThumbs.forEach((thumb, i) => {
            thumb.addEventListener('click', () => {
                showInMain(i);
            });
        });

        // Lightbox setup
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

        function showLightboxImage(index) {
            currentIndex = index;
            lightboxImg.src = allImages[index].src;
            lightboxImg.alt = allImages[index].alt;
            lightboxCounter.textContent = `${index + 1} / ${allImages.length}`;
        }

        function nextImage() {
            showLightboxImage((currentIndex + 1) % allImages.length);
        }

        function prevImage() {
            showLightboxImage((currentIndex - 1 + allImages.length) % allImages.length);
        }

        // Main image click: open lightbox at current image
        mainScreenshot.style.cursor = 'zoom-in';
        mainScreenshot.addEventListener('click', () => {
            showLightboxImage(currentIndex);
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        function closeLightbox() {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
            // Sync main image + active thumb with where lightbox ended
            showInMain(currentIndex);
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

    // ==========================================
    // STANDALONE IMAGE LIGHTBOX (for images outside the main gallery)
    // ==========================================

    const standaloneImages = document.querySelectorAll('[data-lightbox], .characters-group-img');

    if (standaloneImages.length > 0) {
        const standaloneSrcs = Array.from(standaloneImages).map(img => ({ src: img.src, alt: img.alt }));
        let standaloneIndex = 0;

        // Reuse existing lightbox if available, otherwise create one
        let sLightbox = document.querySelector('.lightbox');
        if (!sLightbox) {
            sLightbox = document.createElement('div');
            sLightbox.className = 'lightbox';
            sLightbox.innerHTML = `
                <button class="lightbox-close" aria-label="Close">&times;</button>
                <button class="lightbox-prev" aria-label="Previous">&#8249;</button>
                <img class="lightbox-img" src="" alt="">
                <button class="lightbox-next" aria-label="Next">&#8250;</button>
                <div class="lightbox-counter"></div>
            `;
            document.body.appendChild(sLightbox);

            const sClose = sLightbox.querySelector('.lightbox-close');
            const sPrev = sLightbox.querySelector('.lightbox-prev');
            const sNext = sLightbox.querySelector('.lightbox-next');

            sClose.addEventListener('click', () => {
                sLightbox.classList.remove('active');
                document.body.style.overflow = '';
            });
            sPrev.addEventListener('click', (e) => { e.stopPropagation(); standaloneNav(-1); });
            sNext.addEventListener('click', (e) => { e.stopPropagation(); standaloneNav(1); });
            sLightbox.addEventListener('click', (e) => {
                if (e.target === sLightbox) {
                    sLightbox.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
            document.addEventListener('keydown', (e) => {
                if (!sLightbox.classList.contains('active')) return;
                if (e.key === 'Escape') { sLightbox.classList.remove('active'); document.body.style.overflow = ''; }
                if (e.key === 'ArrowRight') standaloneNav(1);
                if (e.key === 'ArrowLeft') standaloneNav(-1);
            });
        }

        const sImg = sLightbox.querySelector('.lightbox-img');
        const sCounter = sLightbox.querySelector('.lightbox-counter');
        const sPrevBtn = sLightbox.querySelector('.lightbox-prev');
        const sNextBtn = sLightbox.querySelector('.lightbox-next');

        function showStandalone(index) {
            standaloneIndex = index;
            sImg.src = standaloneSrcs[index].src;
            sImg.alt = standaloneSrcs[index].alt;
            if (standaloneSrcs.length <= 1) {
                sPrevBtn.style.display = 'none';
                sNextBtn.style.display = 'none';
                sCounter.style.display = 'none';
            } else {
                sPrevBtn.style.display = '';
                sNextBtn.style.display = '';
                sCounter.style.display = '';
                sCounter.textContent = `${index + 1} / ${standaloneSrcs.length}`;
            }
        }

        function standaloneNav(dir) {
            showStandalone((standaloneIndex + dir + standaloneSrcs.length) % standaloneSrcs.length);
        }

        standaloneImages.forEach((img, i) => {
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', () => {
                showStandalone(i);
                sLightbox.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });
    }

    // ==========================================
    // CHARACTERS, SKINS & CHARACTER MODAL
    // ==========================================

    const skinsTabs = document.getElementById('skinsTabs');
    const skinsGrid = document.getElementById('skinsGrid');

    if (skinsTabs && skinsGrid) {
        const basePath = '../img/starboys/StarboySkins';

        const characters = [
            { name: 'Arcadia',  file: 'forestgreen', bio: 'A natural leader with an unshakeable sense of justice. Arcadia fights to protect those who cannot protect themselves.' },
            { name: 'Antheia',  file: 'teal',        bio: 'Graceful and swift, Antheia moves like the wind. Her agility makes her nearly impossible to pin down.' },
            { name: 'Athena',   file: 'yellow',      bio: 'The strategist of the group. Athena approaches every battle with a plan and always stays three steps ahead.' },
            { name: 'Astraea',  file: 'orange',      bio: 'Guided by the stars, Astraea brings balance to chaos. Her cosmic intuition is unmatched.' },
            { name: 'Apollo',   file: 'green',       bio: 'Radiant and confident, Apollo lights up every arena. His precision and timing are legendary.' },
            { name: 'Artemis',  file: 'pink',        bio: 'A lone hunter who thrives in the shadows. Artemis strikes from unexpected angles with deadly accuracy.' },
            { name: 'Asteria',  file: 'purple',      bio: 'Born from stardust, Asteria harnesses celestial energy. Her powers grow stronger under the night sky.' },
            { name: 'Atlas',    file: 'blue',        bio: 'The immovable force. Atlas can take hits that would flatten anyone else and keep on fighting.' },
            { name: 'Ares',     file: 'red',         bio: 'Pure aggression channeled into combat. Ares lives for the thrill of battle and never backs down.' },
            { name: 'Aether',   file: 'white',       bio: 'Mysterious and ethereal, Aether phases between dimensions. Now you see them, now you don\'t.' },
            { name: 'Aion',     file: 'grey',        bio: 'Master of time itself. Aion bends moments to their will, creating openings where none existed.' },
            { name: 'Alastor',  file: 'black',       bio: 'The wild card. Unpredictable and relentless, Alastor keeps opponents guessing until it\'s too late.' },
        ];

        const skins = [
            { name: 'Matte',          folder: 'MATTE' },
            { name: 'Flat',           folder: 'FLAT' },
            { name: 'Ceramic',        folder: 'CERAMIC' },
            { name: 'Chrome',         folder: 'CHROME' },
            { name: 'Galaxy',         folder: 'Characters (GALAXY)' },
            { name: 'Galaxy + Glass', folder: 'GALAXY + GLASS' },
            { name: 'Matcap Core',    folder: 'MATCAP CORE' },
            { name: 'Grid',           folder: 'GRID' },
            { name: 'Goopy',          folder: 'GOOPY' },
            { name: 'Potion',         folder: 'POTION' },
            { name: 'Potion + Glass', folder: 'POTION + GLASS' },
            { name: 'Asphalt',        folder: 'ASPHALT' },
            { name: 'Brick',          folder: 'BRICK' },
            { name: 'Metal Circles',  folder: 'METAL CIRCLES' },
        ];

        const defaultSkin = 5; // Galaxy + Glass
        let activeSkin = defaultSkin;

        function skinImagePath(folder, colorFile) {
            return `${basePath}/${folder}/${colorFile}.png`;
        }

        // Render tabs
        skins.forEach((skin, i) => {
            const tab = document.createElement('button');
            tab.className = 'skins-tab' + (i === defaultSkin ? ' skins-tab--active' : '');
            tab.textContent = skin.name;
            tab.addEventListener('click', () => showSkin(i));
            skinsTabs.appendChild(tab);
        });

        function showSkin(index) {
            activeSkin = index;
            const skin = skins[index];

            skinsTabs.querySelectorAll('.skins-tab').forEach((t, i) => {
                t.classList.toggle('skins-tab--active', i === index);
            });

            skinsGrid.innerHTML = '';
            characters.forEach(char => {
                const card = document.createElement('div');
                card.className = 'character-card';

                const imgWrap = document.createElement('div');
                imgWrap.className = 'character-skin-img';
                const img = document.createElement('img');
                img.src = skinImagePath(skin.folder, char.file);
                img.alt = `${char.name} — ${skin.name}`;
                img.loading = 'lazy';
                imgWrap.appendChild(img);

                const name = document.createElement('span');
                name.className = 'character-name';
                name.textContent = char.name;

                const bio = document.createElement('p');
                bio.className = 'character-bio';
                bio.textContent = char.bio;

                card.appendChild(imgWrap);
                card.appendChild(name);
                card.appendChild(bio);
                skinsGrid.appendChild(card);
            });
        }

        showSkin(defaultSkin);
    }

})();
