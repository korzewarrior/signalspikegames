// Signal Spike Games Website Scripts

document.addEventListener('DOMContentLoaded', function() {
    // Direct home link handler
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            
            // Update active state
            document.querySelectorAll('.main-nav a').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
        });
    }

    // Enhanced smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            // Special case for home link - more direct approach
            if (targetId === '#') {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                
                // Update active nav state for home
                document.querySelectorAll('.main-nav a').forEach(navLink => {
                    navLink.classList.remove('active');
                });
                this.classList.add('active');
                return;
            }
            
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            // Smooth scroll animation with easing
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Update active nav state
            document.querySelectorAll('.main-nav a').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
        });
    });

    // Enhanced navbar scroll effect
    const header = document.querySelector('header');
    let lastScrollTop = 0;
    const scrollThreshold = 10;
    
    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Enhanced header transformation
        if (scrollTop > scrollThreshold) {
            header.classList.add('scrolled');
            // Remove the hiding behavior
            header.style.transform = 'translateY(0)';
        } else {
            header.classList.remove('scrolled');
            header.style.transform = 'translateY(0)';
        }
        
        // Update active nav based on scroll position
        updateActiveNavOnScroll();
        
        lastScrollTop = scrollTop;
        
        // Reveal elements on scroll
        revealElements();
    });
    
    // Update active nav based on scroll position
    function updateActiveNavOnScroll() {
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Get all sections and corresponding nav items
        const sections = document.querySelectorAll('section[id]');
        const navItems = document.querySelectorAll('.main-nav a');
        
        // Check if at the top of the page - activate Home
        if (scrollPosition < 100) {
            navItems.forEach(item => item.classList.remove('active'));
            const homeLink = document.querySelector('#home-link');
            if (homeLink) {
                homeLink.classList.add('active');
            }
            return;
        }
        
        // Check if at the bottom of the page - activate Contact
        if ((window.innerHeight + window.pageYOffset) >= document.body.offsetHeight - 100) {
            navItems.forEach(item => item.classList.remove('active'));
            const contactLink = document.querySelector('.main-nav a[href="#contact"]');
            if (contactLink) {
                contactLink.classList.add('active');
            }
            return;
        }
        
        // Determine which section is currently in view for all other sections
        let currentSection = null;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if(scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSection = sectionId;
            }
        });
        
        // Remove active class from all nav items
        navItems.forEach(item => item.classList.remove('active'));
        
        // Add active class to corresponding nav item
        if (currentSection) {
            const correspondingNavItem = document.querySelector(`.main-nav a[href="#${currentSection}"]`);
            if(correspondingNavItem) {
                correspondingNavItem.classList.add('active');
            }
        }
    }
    
    // Initialize section reveals
    initRevealElements();
    revealElements(); // Initial check for elements in view
    updateActiveNavOnScroll(); // Initial active nav state
    
    // Form submission handlers
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formParent = this.parentElement;
            const successMessage = formParent.querySelector('.form-success');
            
            if (successMessage) {
                this.style.display = 'none';
                successMessage.style.display = 'block';
                
                setTimeout(() => {
                    this.style.display = 'block';
                    successMessage.style.display = 'none';
                }, 3000);
            }
            
            this.reset();
        });
    });
    
    // Update copyright year
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // Helper function to initialize reveal elements
    function initRevealElements() {
        const sections = document.querySelectorAll('section');
        sections.forEach(section => {
            section.classList.add('reveal-element');
            section.style.opacity = "0.95"; // Starting almost fully visible
            section.style.transform = "translateY(10px)"; // Smaller transform
        });
        
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach((card, index) => {
            card.classList.add('reveal-element');
            card.style.opacity = "0.95";
            card.style.transform = "translateY(10px)";
            card.dataset.delay = index * 100; // Shorter delay
        });
        
        const featuredImage = document.querySelector('.featured-image');
        if (featuredImage) {
            featuredImage.classList.add('reveal-element');
            featuredImage.classList.add('reveal-right');
            featuredImage.style.opacity = "0.95";
            featuredImage.style.transform = "translateX(10px)";
        }
        
        const featuredText = document.querySelector('.featured-text');
        if (featuredText) {
            featuredText.classList.add('reveal-element');
            featuredText.classList.add('reveal-left');
            featuredText.style.opacity = "0.95";
            featuredText.style.transform = "translateX(-10px)";
        }
    }
    
    // Helper function to reveal elements on scroll
    function revealElements() {
        const elements = document.querySelectorAll('.reveal-element');
        const windowHeight = window.innerHeight;
        
        elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const delay = element.dataset.delay || 0;
            
            if (elementTop < windowHeight - 50) {
                setTimeout(() => {
                    element.style.opacity = "1";
                    element.style.transform = "translate(0)";
                    element.style.transition = "opacity 0.5s ease, transform 0.5s ease";
                }, delay);
            }
        });
    }
}); 