// Signal Spike Games Website Scripts

document.addEventListener('DOMContentLoaded', function() {
    // Navbar scroll effect
    const header = document.querySelector('header');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 10) {
            header.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.1)';
            header.style.padding = '10px 0';
        } else {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            header.style.padding = '20px 0';
        }
        
        lastScrollTop = scrollTop;
    });

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
}); 