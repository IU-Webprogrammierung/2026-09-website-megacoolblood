function markCurrentPage(link) {
  const linkUrl = new URL(link.href, window.location.href);
  const currentUrl = new URL(window.location.href);

  if (linkUrl.pathname === currentUrl.pathname) {
    link.setAttribute('aria-current', 'page');
  }
}

function initializeMainNavigation(template) {
  const button = template.content.querySelector('[data-menu-toggle]');
  const navigation = template.content.querySelector('[data-main-navigation]');

  if (!button || !navigation) {
    return;
  }

  const mobileQuery = window.matchMedia('(max-width: 767px)');
  let isOpen = false;

  function updateNavigation() {
    const isMobile = mobileQuery.matches;
    button.hidden = !isMobile;
    navigation.hidden = isMobile ? !isOpen : false;
    button.setAttribute('aria-expanded', String(isMobile && isOpen));
    button.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
  }

  function closeNavigation() {
    isOpen = false;
    updateNavigation();
  }

  button.addEventListener('click', () => {
    isOpen = !isOpen;
    updateNavigation();
    if (isOpen) {
      navigation.querySelector('a')?.focus();
    }
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      closeNavigation();
    }
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNavigation();
    }
  });

  navigation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNavigation();
      button.focus();
    }
  });

  mobileQuery.addEventListener('change', () => {
    isOpen = false;
    updateNavigation();
  });

  updateNavigation();
}

async function createSubnavigation(template) {
  const gameDirectory = window.location.pathname.match(
    /^(.*\/pages\/[^/]+\/)/
  );

  if (!gameDirectory) {
    return;
  }

  const navigation = template.content.querySelector('[data-subnavigation]');

  if (!navigation) {
    return;
  }

  const subnavigationPath = `${gameDirectory[1]}subnavigation.html`;
  let response = await fetch(subnavigationPath);

  const subnavigation = document.createElement('template');
  subnavigation.innerHTML = await response.text();

  subnavigation.content.querySelectorAll('a[href]').forEach((link) => {
    const url = new URL(link.getAttribute('href'), response.url);
    link.href = url.href;
    markCurrentPage(link);
  });

  navigation.replaceChildren(...subnavigation.content.childNodes);
  navigation.hidden = false;
}

function resolveComponentPaths(template, rootPath) {
  template.content.querySelectorAll('[href], [src]').forEach((element) => {
    const attribute = element.hasAttribute('href') ? 'href' : 'src';
    const value = element.getAttribute(attribute);

    const isAbsolute = ['#', '/', 'http', 'mailto:']
      .some((prefix) => value.startsWith(prefix));

    if (!isAbsolute) {
      element.setAttribute(attribute, rootPath + value);
    }
  });
}

async function loadComponent(component) {
  const path = component.getAttribute('path');
  const response = await fetch(path);
  const template = document.createElement('template');
  template.innerHTML = await response.text();

  const rootPath = path.slice(0, path.indexOf('components/'));

  resolveComponentPaths(template, rootPath);

  template.content.querySelectorAll('a[href]').forEach((link) => {
    markCurrentPage(link);
  });

  initializeMainNavigation(template);
  await createSubnavigation(template);
  component.replaceWith(template.content);
}

async function loadComponents() {
  await Promise.all(
    [...document.querySelectorAll('component[path]')]
      .map(loadComponent)
  );
}

// Pages can wait for the header and footer, for example before measuring layout.
window.lycheelabComponentsLoaded = loadComponents().catch(console.error);
