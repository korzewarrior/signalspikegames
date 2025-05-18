// Signal Spike Games Website Scripts

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
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
            
            // Hide header when scrolling down, show when scrolling up
            if (scrollTop > lastScrollTop && scrollTop > 150) {
                header.style.transform = 'translateY(-100%)';
            } else {
                header.style.transform = 'translateY(0)';
            }
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollTop = scrollTop;
        
        // Reveal elements on scroll
        revealElements();
    });
    
    // Initialize section reveals
    initRevealElements();
    revealElements(); // Initial check for elements in view
    
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
            section.style.opacity = "0";
            section.style.transform = "translateY(30px)";
        });
        
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach((card, index) => {
            card.classList.add('reveal-element');
            card.style.opacity = "0";
            card.style.transform = "translateY(30px)";
            card.dataset.delay = index * 150; // Staggered reveal
        });
        
        const featuredImage = document.querySelector('.featured-image');
        if (featuredImage) {
            featuredImage.classList.add('reveal-element');
            featuredImage.classList.add('reveal-right');
            featuredImage.style.opacity = "0";
            featuredImage.style.transform = "translateX(30px)";
        }
        
        const featuredText = document.querySelector('.featured-text');
        if (featuredText) {
            featuredText.classList.add('reveal-element');
            featuredText.classList.add('reveal-left');
            featuredText.style.opacity = "0";
            featuredText.style.transform = "translateX(-30px)";
        }
    }
    
    // Helper function to reveal elements on scroll
    function revealElements() {
        const elements = document.querySelectorAll('.reveal-element');
        const windowHeight = window.innerHeight;
        
        elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const delay = element.dataset.delay || 0;
            
            if (elementTop < windowHeight - 100) {
                setTimeout(() => {
                    element.style.opacity = "1";
                    element.style.transform = "translate(0)";
                    element.style.transition = "opacity 0.8s ease, transform 0.8s ease";
                }, delay);
            }
        });
    }
}); 