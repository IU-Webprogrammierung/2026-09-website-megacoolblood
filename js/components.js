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

    component.replaceWith(template.content);
}

async function loadComponents() {
    await Promise.all(
        [...document.querySelectorAll('component[path]')]
            .map(loadComponent)
    );
}

loadComponents().catch(console.error);