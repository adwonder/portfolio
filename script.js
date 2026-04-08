// ===== Render: Home Page (works list) =====
async function renderWorks() {
    const worksEl = document.querySelector('.works');
    if (!worksEl) return;

    const projects = typeof PROJECTS !== 'undefined' ? PROJECTS : [];

    worksEl.innerHTML = projects.map((p, i) => `
        <article class="project" data-href="project.html?id=${p.id}" style="transition-delay: ${0.1 * (i + 1)}s">
            <div class="project-info" data-year="${p.year}">
                <span class="project-title">${p.title}</span>
            </div>
            <div class="project-image" data-title="${p.title}" data-cover="${p.cover}" data-media="${p.media}">
                <div class="placeholder-img"></div>
            </div>
            <div class="project-meta">
                <span class="project-year">${p.year}</span>
            </div>
        </article>
    `).join('');

    // Load cover images, then reveal projects
    const projectEls = document.querySelectorAll('.project');
    const imageEls = document.querySelectorAll('.project-image[data-cover]');
    let loaded = 0;
    const total = imageEls.length;

    function revealWorks() {
        projectEls.forEach(el => el.classList.add('visible'));
    }

    // Fallback: reveal after 3s even if images haven't loaded
    setTimeout(revealWorks, 3000);

    imageEls.forEach(el => {
        const src = el.dataset.cover;
        if (!src) { loaded++; return; }
        const img = new Image();
        img.onload = () => {
            el.innerHTML = '';
            img.alt = el.dataset.title;
            img.style.width = '100%';
            img.style.display = 'block';
            el.appendChild(img);
            loaded++;
            if (loaded >= total) revealWorks();
        };
        img.onerror = () => {
            loaded++;
            if (loaded >= total) revealWorks();
        };
        img.src = src;
    });

    if (!total) revealWorks();

    initProjectClicks();
    initScrollReveal();
}

// ===== Render: Project Detail Page =====
async function renderProject() {
    const heroEl = document.querySelector('.project-hero');
    if (!heroEl) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const projects = typeof PROJECTS !== 'undefined' ? PROJECTS : [];
    const p = projects.find(proj => proj.id === id);

    if (!p) {
        heroEl.innerHTML = '<p style="text-align:center;padding:200px 40px;color:#666">Project not found</p>';
        return;
    }

    document.title = 'wonder';

    // Hero
    heroEl.innerHTML = `<a href="index.html" class="back-link">Back to works</a><div class="project-hero-media"></div>`;

    const heroMedia = heroEl.querySelector('.project-hero-media');
    const detailEl = document.querySelector('.project-detail');

    function revealProject() {
        heroEl.classList.add('visible');
        setTimeout(() => detailEl.classList.add('visible'), 200);
        // Re-init scroll reveal for gallery items after layout settles
        setTimeout(() => initScrollReveal(), 500);
    }

    let revealed = false;
    function safeReveal() {
        if (revealed) return;
        revealed = true;
        revealProject();
    }

    // Fallback: reveal after 3s even if media hasn't loaded
    setTimeout(safeReveal, 3000);

    if (p.media === 'video' && p.video) {
        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'metadata';
        if (p.cover) video.poster = p.cover; // show cover while video loads
        video.onloadedmetadata = () => {
            heroMedia.appendChild(video);
            heroMedia.style.minHeight = '';
            safeReveal();
        };
        video.src = p.video;
        video.onerror = () => {
            // Video failed, try cover image as fallback
            if (p.cover) {
                const img = new Image();
                img.alt = p.title;
                img.onload = () => {
                    heroMedia.appendChild(img);
                    heroMedia.style.minHeight = '';
                    safeReveal();
                };
                img.onerror = safeReveal;
                img.src = p.cover;
            } else {
                safeReveal();
            }
        };
    } else if (p.cover) {
        const img = new Image();
        img.alt = p.title;
        img.onload = () => {
            heroMedia.appendChild(img);
            heroMedia.style.minHeight = '';
            safeReveal();
        };
        img.onerror = safeReveal;
        img.src = p.cover;
    } else {
        safeReveal();
    }

    // Details
    detailEl.innerHTML = `
        <div class="project-detail-header">
            <h1 class="project-detail-title">${p.title}</h1>
        </div>
        <div class="project-detail-meta">
            <div class="meta-item">
                <span class="meta-label">Client</span>
                <span class="meta-value">${p.client}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Year</span>
                <span class="meta-value">${p.year}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Expertise</span>
                <span class="meta-value">${p.expertise.join('<br>')}</span>
            </div>
        </div>
        <div class="project-detail-description">
            ${p.description.map(text => `<p>${text}</p>`).join('')}
        </div>`;

    // Gallery
    const galleryEl = document.querySelector('.project-gallery');
    if (p.gallery && p.gallery.length > 0) {
        galleryEl.innerHTML = p.gallery.map((img, i) => `
            <div class="gallery-item${i === 0 && p.gallery.length > 2 ? ' full' : ''}" style="transition-delay: ${i * 0.15}s">
                <img src="${img}" alt="${p.title} — ${i + 1}">
            </div>
        `).join('');
    }

    // Lightbox: hero cover (image projects only) + gallery
    const hasHeroImage = p.media !== 'video' && p.cover;
    const lightboxImages = [
        ...(hasHeroImage ? [p.cover] : []),
        ...(p.gallery || [])
    ];

    if (lightboxImages.length > 0) {
        const openLightbox = initLightbox(lightboxImages, p.title);
        const galleryOffset = hasHeroImage ? 1 : 0;

        // Gallery item clicks (with offset to account for hero at index 0)
        galleryEl.querySelectorAll('.gallery-item').forEach((item, i) => {
            item.addEventListener('click', () => openLightbox(i + galleryOffset));
        });

        // Hero image click
        if (hasHeroImage) {
            heroMedia.addEventListener('click', (e) => {
                if (e.target.tagName === 'IMG') openLightbox(0);
            });
        }
    }
}

// ===== Lightbox =====
function initLightbox(images, title) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <button class="lightbox-close">&times;</button>
        <button class="lightbox-nav lightbox-prev">&#8249;</button>
        <img src="" alt="">
        <button class="lightbox-nav lightbox-next">&#8250;</button>
        <div class="lightbox-counter"></div>`;
    document.body.appendChild(lightbox);

    const img = lightbox.querySelector('img');
    const counter = lightbox.querySelector('.lightbox-counter');
    let current = 0;

    function show(index) {
        current = (index + images.length) % images.length;
        img.style.width = '';
        img.style.height = '';
        img.src = images[current];
        img.alt = `${title} — ${current + 1}`;
        counter.textContent = `${current + 1} / ${images.length}`;
        // Force full-quality decode + explicit pixel sizing to fix iOS Safari downsampling
        if (img.decode) {
            img.decode().then(() => {
                if (!img.naturalWidth) return;
                const maxW = window.innerWidth * 0.9;
                const maxH = window.innerHeight * 0.9;
                const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
                img.style.width  = Math.round(img.naturalWidth  * scale) + 'px';
                img.style.height = Math.round(img.naturalHeight * scale) + 'px';
            }).catch(() => {});
        }
    }

    function open(index) {
        show(index);
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Hide nav and counter when only one image
    if (images.length <= 1) {
        lightbox.querySelector('.lightbox-prev').style.display = 'none';
        lightbox.querySelector('.lightbox-next').style.display = 'none';
        lightbox.querySelector('.lightbox-counter').style.display = 'none';
    }

    lightbox.querySelector('.lightbox-close').addEventListener('click', close);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
    lightbox.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(current - 1);
        if (e.key === 'ArrowRight') show(current + 1);
    });

    // Touch swipe support
    let touchStartX = 0;
    let touchStartY = 0;
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx < 0) show(current + 1);
            else show(current - 1);
        }
    }, { passive: true });

    return open;
}

// ===== Render: About Page =====
async function renderAbout() {
    const aboutEl = document.querySelector('.about');
    if (!aboutEl) return;

    const config = typeof CONFIG !== 'undefined' ? CONFIG : {};
    const a = config.about;

    aboutEl.innerHTML = `
        <div class="about-grid">
            <div>
                <h1 class="about-heading">${a.heading}</h1>
                <div class="about-text">
                    ${a.text.map(t => `<p>${t}</p>`).join('')}
                </div>
                <div class="about-skills">
                    <h3>Tools & Skills</h3>
                    <div class="skills-list">
                        ${a.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
            <div class="about-photo">
                <img src="photo.jpg" alt="Photo" onerror="this.outerHTML='<span class=\\'about-photo-placeholder\\'>Your Photo</span>'">
            </div>
        </div>`;

    // Reveal after photo loads
    const aboutGrid = aboutEl.querySelector('.about-grid');
    const photo = aboutGrid.querySelector('.about-photo img');
    if (photo) {
        photo.onload = () => aboutGrid.classList.add('visible');
        photo.addEventListener('error', () => aboutGrid.classList.add('visible'));
        // Fallback
        setTimeout(() => aboutGrid.classList.add('visible'), 3000);
    } else {
        aboutGrid.classList.add('visible');
    }

    // Lightbox for about photo
    const openAboutLightbox = initLightbox(['photo.jpg'], a.heading || 'Photo');
    const aboutPhotoEl = aboutGrid.querySelector('.about-photo');
    if (aboutPhotoEl) {
        aboutPhotoEl.addEventListener('click', () => openAboutLightbox(0));
    }
}

// ===== Render: Contact Footer =====
async function renderContact() {
    const contactEl = document.querySelector('.contact');
    if (!contactEl) return;

    const config = typeof CONFIG !== 'undefined' ? CONFIG : {};

    const socialsHTML = Object.entries(config.socials)
        .map(([name, url]) => `<a href="${url}" class="social-link" target="_blank">${name}</a>`)
        .join('');

    contactEl.innerHTML = `
        <div class="contact-inner">
            <h2 class="contact-heading">${config.contactHeading}</h2>
            <a href="mailto:${config.email}" class="contact-email">${config.email}</a>
            <div class="contact-socials">${socialsHTML}</div>
        </div>`;
}

// ===== Project Click Navigation =====
function initProjectClicks() {
    document.querySelectorAll('.project[data-href]').forEach(project => {
        project.addEventListener('click', () => {
            window.location.href = project.getAttribute('data-href');
        });
    });
}

// ===== Scroll Reveal =====
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.project, .contact-inner, .about-grid, .gallery-item').forEach(el => {
        observer.observe(el);
    });
}

// ===== Custom Cursor =====
function initCursor() {
    // Skip on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    const cursor = document.createElement('div');
    cursor.classList.add('custom-cursor');
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('a, .project, button, .play-btn, .project-hero-media, .about-photo')) {
            cursor.classList.add('hover');
        } else {
            cursor.classList.remove('hover');
        }
    });
}

// ===== Header Auto-hide =====
function initHeader() {
    let lastScroll = 0;
    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > lastScroll && currentScroll > 100) {
            header.style.transform = 'translateY(-100%)';
            header.style.transition = 'transform 0.4s ease';
        } else {
            header.style.transform = 'translateY(0)';
        }
        lastScroll = currentScroll;
    });
}

// ===== Smooth Scroll =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ===== Replay Animations on Tab Focus =====
function initTabReveal() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Replay all class-based transitions
            document.querySelectorAll('.project.visible, .project-hero.visible, .project-detail.visible, .about-grid.visible, .contact-inner.visible, .gallery-item.visible').forEach(el => {
                el.classList.remove('visible');
                el.offsetHeight;
                el.classList.add('visible');
            });
        }
    });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    initCursor();
    initHeader();
    initSmoothScroll();
    initTabReveal();

    // Render based on current page
    await Promise.all([
        renderWorks(),
        renderProject(),
        renderAbout(),
        renderContact(),
    ]);

    initScrollReveal();
});
