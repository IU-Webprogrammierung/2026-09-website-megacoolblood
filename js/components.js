function markCurrentPage(link) {
    const linkUrl = new URL(link.href, window.location.href);
    const currentUrl = new URL(window.location.href);

    if (linkUrl.pathname === currentUrl.pathname) {
        link.setAttribute('aria-current', 'page');
    }
}

async function createSubnavigation(template) {
    const gameDirectory = window.location.pathname.match(
        /^(.*\/pages\/[^/]+\/)/
    );

    if (!gameDirectory) {
        return;
    }

    const navigation = template.content.querySelector('[data-subnavigation]');

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

    await createSubnavigation(template);
    component.replaceWith(template.content);
}

async function loadComponents() {
    await Promise.all(
        [...document.querySelectorAll('component[path]')]
            .map(loadComponent)
    );
}

loadComponents().catch(console.error);