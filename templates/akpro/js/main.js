/* ============================================
   AK Projections - Main JavaScript
   Animations, Interactions & Functionality
   ============================================ */

(function () {
  'use strict';

  /* ---------- DOM Ready ---------- */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initLoader();
    initNavbar();
    initMobileMenu();
    initCustomCursor();
    initScrollReveal();
    initScrollProgress();
    initBackToTop();
    initParticles();
    initCountUp();
    initFAQ();
    initRippleButtons();
    initMagneticButtons();
    initTiltCards();
    initSmoothScroll();
    initCookieBanner();
    initPageTransition();
    initTypingEffect();
    initFormValidation();
  }

  /* ===========================================
     Loading Screen
     =========================================== */
  function initLoader() {
    const loader = document.querySelector('.loader');
    if (!loader) return;

    document.body.classList.add('loading');

    window.addEventListener('load', function () {
      setTimeout(function () {
        loader.classList.add('hidden');
        document.body.classList.remove('loading');
        // Trigger hero animations after loader
        animateHero();
      }, 2400);
    });

    // Fallback: remove loader after 4s even if load event fails
    setTimeout(function () {
      loader.classList.add('hidden');
      document.body.classList.remove('loading');
      animateHero();
    }, 4000);
  }

  /* ===========================================
     Hero Entrance Animations
     =========================================== */
  function animateHero() {
    const heroElements = document.querySelectorAll('.hero-content > *');
    heroElements.forEach(function (el, i) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ' + (i * 0.12 + 0.1) + 's';
      requestAnimationFrame(function () {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  }

  /* ===========================================
     Navbar
     =========================================== */
  function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    var lastScroll = 0;

    window.addEventListener('scroll', function () {
      var currentScroll = window.pageYOffset;

      if (currentScroll > 80) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      lastScroll = currentScroll;
    }, { passive: true });

    // Set active nav link based on current page
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  /* ===========================================
     Mobile Menu
     =========================================== */
  function initMobileMenu() {
    var toggle = document.querySelector('.nav-toggle');
    var mobileMenu = document.querySelector('.mobile-menu');
    if (!toggle || !mobileMenu) return;

    toggle.addEventListener('click', function () {
      toggle.classList.toggle('active');
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.classList.remove('active');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ===========================================
     Custom Cursor
     =========================================== */
  function initCustomCursor() {
    var cursor = document.querySelector('.cursor');
    var dot = document.querySelector('.cursor-dot');
    if (!cursor || !dot) return;

    // Only on desktop
    if (window.innerWidth < 768) {
      cursor.style.display = 'none';
      dot.style.display = 'none';
      return;
    }

    var mouseX = 0, mouseY = 0;
    var cursorX = 0, cursorY = 0;

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';
    });

    // Smooth follow for outer cursor
    function animateCursor() {
      cursorX += (mouseX - cursorX) * 0.12;
      cursorY += (mouseY - cursorY) * 0.12;
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover states
    var hoverTargets = document.querySelectorAll('a, button, .card, .card-glass, .showcase-item, .portfolio-item, .filter-btn');
    hoverTargets.forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('hover'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('hover'); });
    });
  }

  /* ===========================================
     Scroll Reveal (Intersection Observer)
     =========================================== */
  function initScrollReveal() {
    var reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children');
    if (!reveals.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ===========================================
     Scroll Progress Bar
     =========================================== */
  function initScrollProgress() {
    var bar = document.querySelector('.scroll-progress');
    if (!bar) return;

    window.addEventListener('scroll', function () {
      var scrollTop = window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = (scrollTop / docHeight) * 100;
      bar.style.width = progress + '%';
    }, { passive: true });
  }

  /* ===========================================
     Back to Top
     =========================================== */
  function initBackToTop() {
    var btn = document.querySelector('.back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', function () {
      if (window.pageYOffset > 500) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ===========================================
     Particles (Hero)
     =========================================== */
  function initParticles() {
    var container = document.querySelector('.particles');
    if (!container) return;

    var count = window.innerWidth < 768 ? 20 : 40;

    for (var i = 0; i < count; i++) {
      var particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDuration = (Math.random() * 8 + 6) + 's';
      particle.style.animationDelay = (Math.random() * 10) + 's';
      particle.style.width = (Math.random() * 3 + 1) + 'px';
      particle.style.height = particle.style.width;
      particle.style.opacity = Math.random() * 0.5 + 0.1;
      container.appendChild(particle);
    }
  }

  /* ===========================================
     Count Up Animation
     =========================================== */
  function initCountUp() {
    var counters = document.querySelectorAll('.count-up');
    if (!counters.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var duration = 2000;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      el.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = prefix + target.toLocaleString() + suffix;
      }
    }

    requestAnimationFrame(step);
  }

  /* ===========================================
     FAQ Accordion
     =========================================== */
  function initFAQ() {
    var items = document.querySelectorAll('.faq-item');
    items.forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) return;

      question.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');
        // Close all
        items.forEach(function (i) { i.classList.remove('open'); });
        // Toggle current
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    });
  }

  /* ===========================================
     Ripple Effect on Buttons
     =========================================== */
  function initRippleButtons() {
    document.querySelectorAll('.btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var rect = btn.getBoundingClientRect();
        var ripple = document.createElement('span');
        ripple.className = 'ripple';
        var size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 600);
      });
    });
  }

  /* ===========================================
     Magnetic Buttons
     =========================================== */
  function initMagneticButtons() {
    if (window.innerWidth < 768) return;

    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transform = 'translate(0, 0)';
      });
    });
  }

  /* ===========================================
     Tilt Cards (3D perspective)
     =========================================== */
  function initTiltCards() {
    if (window.innerWidth < 768) return;

    document.querySelectorAll('.tilt-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;
        var tiltX = (0.5 - y) * 10;
        var tiltY = (x - 0.5) * 10;
        card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg) scale3d(1.02, 1.02, 1.02)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    });
  }

  /* ===========================================
     Smooth Scroll for Anchor Links
     =========================================== */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          var offset = 80;
          var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });
  }

  /* ===========================================
     Cookie Banner
     =========================================== */
  function initCookieBanner() {
    var banner = document.querySelector('.cookie-banner');
    if (!banner) return;

    if (!localStorage.getItem('akpro_cookies_accepted')) {
      setTimeout(function () {
        banner.classList.add('visible');
      }, 3000);
    }

    var acceptBtn = banner.querySelector('.cookie-accept');
    var declineBtn = banner.querySelector('.cookie-decline');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem('akpro_cookies_accepted', 'true');
        banner.classList.remove('visible');
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        banner.classList.remove('visible');
      });
    }
  }

  /* ===========================================
     Page Transition
     =========================================== */
  function initPageTransition() {
    var transition = document.querySelector('.page-transition');
    if (!transition) return;

    document.querySelectorAll('a[href]').forEach(function (link) {
      // Skip external links, hash links, and new tab links
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') {
        return;
      }

      link.addEventListener('click', function (e) {
        e.preventDefault();
        transition.style.transformOrigin = 'bottom';
        transition.style.transform = 'scaleY(1)';

        setTimeout(function () {
          window.location.href = href;
        }, 500);
      });
    });

    // Animate in on page load
    transition.style.transformOrigin = 'top';
    transition.style.transform = 'scaleY(1)';
    setTimeout(function () {
      transition.style.transform = 'scaleY(0)';
    }, 100);
  }

  /* ===========================================
     Typing Effect (Hero)
     =========================================== */
  function initTypingEffect() {
    var el = document.querySelector('.typing-text');
    if (!el) return;

    var words = JSON.parse(el.getAttribute('data-words'));
    if (!words || !words.length) return;

    var wordIndex = 0;
    var charIndex = 0;
    var isDeleting = false;
    var typeSpeed = 100;

    function type() {
      var currentWord = words[wordIndex];

      if (isDeleting) {
        el.textContent = currentWord.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 50;
      } else {
        el.textContent = currentWord.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 100;
      }

      if (!isDeleting && charIndex === currentWord.length) {
        typeSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typeSpeed = 300;
      }

      setTimeout(type, typeSpeed);
    }

    setTimeout(type, 1000);
  }

  /* ===========================================
     Form Validation (Contact / Newsletter)
     =========================================== */
  function initFormValidation() {
    var forms = document.querySelectorAll('.validate-form');
    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var valid = true;
        var fields = form.querySelectorAll('[required]');

        fields.forEach(function (field) {
          // Reset
          field.style.borderColor = '';
          var msg = field.parentElement.querySelector('.error-msg');
          if (msg) msg.remove();

          if (!field.value.trim()) {
            valid = false;
            field.style.borderColor = '#EF4444';
            var error = document.createElement('span');
            error.className = 'error-msg';
            error.style.color = '#EF4444';
            error.style.fontSize = '0.8rem';
            error.style.marginTop = '0.25rem';
            error.style.display = 'block';
            error.textContent = 'This field is required';
            field.parentElement.appendChild(error);
          }

          // Email validation
          if (field.type === 'email' && field.value.trim()) {
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
              valid = false;
              field.style.borderColor = '#EF4444';
              var emailError = document.createElement('span');
              emailError.className = 'error-msg';
              emailError.style.color = '#EF4444';
              emailError.style.fontSize = '0.8rem';
              emailError.style.marginTop = '0.25rem';
              emailError.style.display = 'block';
              emailError.textContent = 'Please enter a valid email';
              field.parentElement.appendChild(emailError);
            }
          }
        });

        if (valid) {
          var btn = form.querySelector('button[type="submit"]');
          var originalText = btn.innerHTML;
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Sent!';
          btn.style.background = '#22C55E';
          btn.style.pointerEvents = 'none';

          setTimeout(function () {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.pointerEvents = '';
            form.reset();
          }, 3000);
        }
      });
    });
  }

  /* ===========================================
     Portfolio Filter (Portfolio page)
     =========================================== */
  window.initPortfolioFilter = function () {
    var filterBtns = document.querySelectorAll('.filter-btn');
    var items = document.querySelectorAll('.portfolio-item');

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        // Update active state
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var filter = btn.getAttribute('data-filter');

        items.forEach(function (item) {
          if (filter === 'all' || item.getAttribute('data-category') === filter) {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.9)';
            item.style.display = '';
            setTimeout(function () {
              item.style.opacity = '1';
              item.style.transform = 'scale(1)';
            }, 50);
          } else {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.9)';
            setTimeout(function () {
              item.style.display = 'none';
            }, 400);
          }
        });
      });
    });
  };

  /* ===========================================
     Pricing Toggle (Pricing page)
     =========================================== */
  window.initPricingToggle = function () {
    var toggle = document.querySelector('.toggle-switch');
    if (!toggle) return;

    var monthlyLabel = document.querySelector('.monthly-label');
    var yearlyLabel = document.querySelector('.yearly-label');
    var monthlyPrices = document.querySelectorAll('.price-monthly');
    var yearlyPrices = document.querySelectorAll('.price-yearly');

    toggle.addEventListener('click', function () {
      toggle.classList.toggle('active');
      var isYearly = toggle.classList.contains('active');

      if (monthlyLabel) monthlyLabel.classList.toggle('active', !isYearly);
      if (yearlyLabel) yearlyLabel.classList.toggle('active', isYearly);

      monthlyPrices.forEach(function (el) { el.style.display = isYearly ? 'none' : ''; });
      yearlyPrices.forEach(function (el) { el.style.display = isYearly ? '' : 'none'; });
    });
  };

  /* ===========================================
     Parallax on scroll (simple)
     =========================================== */
  window.addEventListener('scroll', function () {
    var scrolled = window.pageYOffset;
    var parallaxElements = document.querySelectorAll('[data-parallax]');
    parallaxElements.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.3;
      el.style.transform = 'translateY(' + (scrolled * speed) + 'px)';
    });
  }, { passive: true });

})();
