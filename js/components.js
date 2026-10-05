const subpages = [
    ['game.html', 'Spielen'],
    ['instructions.html', 'Spielanleitung'],
    ['settings.html', 'Einstellungen'],
    ['statistics.html', 'Statistiken']
];

async function createSubnavigation(template) {
    const navigation = template.content.querySelector('[data-subnavigation]');
    const gameDirectory = window.location.pathname.match(
        /^(.*\/pages\/[^/]+\/)/
    );

    if (!navigation || !gameDirectory) {
        navigation?.remove();
        return;
    }

    const directoryUrl = new URL(gameDirectory[1], window.location.origin);
    const links = await Promise.all(
        subpages.map(async ([filename, label]) => {
            const url = new URL(filename, directoryUrl);
            const response = await fetch(url);

            if (!response.ok) {
                return null;
            }

            const link = document.createElement('a');
            link.href = url.href;
            link.textContent = label;

            if (url.pathname === window.location.pathname) {
                link.setAttribute('aria-current', 'page');
            }

            const item = document.createElement('li');
            item.append(link);
            return item;
        })
    );

    const list = navigation.querySelector('ul');
    links.filter(Boolean).forEach((link) => list.append(link));

    if (list.children.length > 0) {
        navigation.hidden = false;
    } else {
        navigation.remove();
    }
}

async function loadComponent(component) {
    const path = component.getAttribute('path');
    const response = await fetch(path);
    const template = document.createElement('template');
    template.innerHTML = await response.text();

    const rootPath = path.slice(0, path.indexOf('components/'));

    template.content.querySelectorAll('[href], [src]').forEach((element) => {
        const attribute = element.hasAttribute('href') ? 'href' : 'src';
        const value = element.getAttribute(attribute);

        const isAbsolute = ['#', '/', 'http', 'mailto:']
            .some((prefix) => value.startsWith(prefix));

        if (!isAbsolute) {
            element.setAttribute(attribute, rootPath + value);
        }
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