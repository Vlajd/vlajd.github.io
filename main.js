/**
 * Async functions called by the user get queued up.
 * This helps preventing unwanted mutations while fetching.
 */
class JobPool {
  static #jobs = new Array();
  static #loopJobs = new Array();
  static #running = false;
  
  /**
   * @param {async (): void} job - Will be called on the next app iteration
   */ 
  static add(job) {
    JobPool.#jobs.push(job);
  }

  /**
   * @param {async (): void} job - Will be called on every iteration for the rest of the app lifetime
   */ 
  static addLoop(job) {
    JobPool.#loopJobs.push(job);
  }

  /**
   * Executes a job iteration.
   */ 
  static async exec() {
    if (JobPool.#running)
      return;

    JobPool.#running = true;

    for (const job of JobPool.#jobs)
      await job();

    JobPool.#jobs.length = 0;

    for (const job of JobPool.#loopJobs)
      await job(); 

    JobPool.#running = false;
  }
}

/**
 * Generic source fetcher
 * #todo with error handling
 */
class Source {
  #response;

  constructor(response) {
    this.#response = response;
  }

  /**
   * Asynchronously fetches the object of the specified path
   * @param {string} path
   * @return {Source}
   */
  static open(path) {
    return new Source(fetch(path));
  }

  /**
   * @return {string}
   */
  async text() {
    const response = await this.#response; 
    if (response.ok)
      return await response.text();

    ViewportPool.open("error", new ErrorParser(response.status));
    return "";
  }

  /**
   * @return {Object}
   */ 
  async json() {
    const response = await this.#response; 
    if (response.ok)
      return await response.json();

    ViewportPool.open("error", new ErrorParser(response.status));
    return false;
  }
}

/**
 * Contains editor information like available colors or if 
 * device is mobile device 
 */
class Settings {
  static #isMobile = false;
  static #data;

  /**
   * Has to be called once before usage
   */
  static init() {
    // Open the settings file
    JobPool.add(async () => Settings.#data = await Source.open("editor.json").json());

    // Update if screen changes to mobile
    JobPool.addLoop(async () => Settings.#isMobile = outerWidth <= 1024);
  }

  /**
   * @return {boolean} true if website should display mobile version
   */ 
  static isMobile() {
    return Settings.#isMobile;
  }

  /**
   * @return {[string, string][]} All available languages
   */ 
  static languages() {
    return Object.entries(Settings.#data.languages);
  }

  /**
   * @return {[string, string][]} All available colors
   */ 
  static colors() {
    return Object.entries(Settings.#data.colors);
  }

  /**
   * @return {[string, string][]} All available fonts
   */ 
  static fonts() {
    return [...Settings.#data.fonts];
  }

  /**
   * @return {string} Currently specified link
   */ 
  static getLink() {
    if (location.search == "")
      return null;
    else
      return location.search.substring(1);
  }

  /**
   * @param {string} link - Link, which should be setted
   */ 
  static setLink(link) {
    history.replaceState(null, null, `?${link}`);
  }
}

/**
 * Handles the appearence of the editor
 */ 
class Theme {
  static #currentColor;
  static #currentFont;
  static #currentFontSize;

  /**
   * Resets all theme settings to the default variables
   */ 
  static default() {
    Theme.setColor("dark");
    Theme.setFont("Roboto");
    Theme.setFontSize(12);
  }

  /**
   * @param {string} code
   */
  static setColor(code) {
    JobPool.add(async () => {
      const [colorCode, color] = Settings.colors().find(([key, _]) => key == code);

      for (const [cc, hex] of Object.entries(color))
        document.documentElement.style.setProperty(`--${cc}`, hex);

      Theme.#currentColor = colorCode;
      User.setColor(colorCode);
    });    
  }

  /**
   * @return {string} color code
   */
  static currentColor() {
    return Theme.#currentColor;
  }

  /**
   * @param {string} font - Font name
   */
  static setFont(font) {
    JobPool.add(async () => {
      WebFont.load({
        google: {
          families: [`${font}:300,400`]
        },
        active: () => {
          document.documentElement.style.setProperty("font-family", font);
          Theme.#currentFont = font;
          User.setFont(font);
        }
      });
    });
  }

  /**
   * @return {string} font name
   */
  static currentFont() {
    return Theme.#currentFont;
  }

  /**
   * @param {number} size - Font size in pt
   */
  static setFontSize(size) {
    document.documentElement.style.setProperty("--font-size", `${size}pt`);
    document.documentElement.style.setProperty("--unbound-font-size", size);
    Theme.#currentFontSize = size;
    User.setFontSize(size);
  }

  /**
   * @return {number} font size in pt
   */
  static currentFontSize() {
    return Theme.#currentFontSize;
  }
}

/**
 * Part of the user settings functionality
 */ 
class Language {
  static #current;
  static #data;

  /**
   * @param {string} code - Language code
   */
  static set(code) {
    JobPool.add(async () => {
      Language.#current = code;
      Language.#data = await Source.open(`${Language.path()}/data.json`).json();
      document.querySelector(".title > .tab-text").innerText = Language.#data.name;
      User.setLanguage(code);
    });
  }

  /**
   * @return {string} Current language code
   */
  static current() {
    return Language.#current;
  }

  /**
   * @return {path} Path to the current language files
   */
  static path() {
    return `lang/${Language.#current}`;
  }

  /**
   * @return {string} Copyright notice in the current language
   */
  static copyright() {
    return Language.#data.copyrightNotice;
  }
}

/**
 * Getters and Setters for user preferences
 */ 
class User {
  /**
   * @return {string} Prefered color scheme. If none, defaults to "dark".
   */
  static preferedColor() {
    const color = localStorage.getItem("preferedColor");
    return color ? color : "dark";
  }

  /**
   * @param {string} color - Set prefered color scheme code
   */
  static setColor(color) {
    localStorage.setItem("preferedColor", color);
  }

  /**
   * @return {string} Prefered font family. If none, defaults to "Roboto".
   */
  static preferedFont() {
    const font = localStorage.getItem("preferedFont");
    return font ? font : "Roboto";
  }

  /**
   * @param {string} font - Set prefered font family
   */
  static setFont(font) {
    localStorage.setItem("preferedFont", font);
  }

  /**
   * @return {number} Prefered font size. If none, defaults to 12.
   */
  static preferedFontSize() {
    const fontSize = Number.parseInt(localStorage.getItem("preferedFontSize"));
    return fontSize ? fontSize : 12;
  }

  /**
   * @param {number} fontSize - Set prefered font size
   */
  static setFontSize(fontSize) {
    localStorage.setItem("preferedFontSize", fontSize);
  }

  /**
   * @return {string} Prefered language code. If none, defaults to "de".
   */
  static preferedLanguage() {
    const language = localStorage.getItem("preferedLanguage");
    return language ? language : "de";
  }

  /**
   * @param {string} code - Set prefered language code
   */
  static setLanguage(code) {
    localStorage.setItem("preferedLanguage", code);
  }

  /**
   * @return {boolean}
   */
  static tutorialized() {
    const tutorialized = localStorage.getItem("tutorialized");
    return tutorialized == "true";
  }

  /**
   * @param {boolean} tutorialized
   */
  static setTutorialized(tutorialized) {
    localStorage.setItem("tutorialized", tutorialized);
  }
}

/**
 * Standard element creation functions
 */ 
class ElementBuilder {
  static #currentSelect;

  /**
   * Has to be called once before usage
   */
  static init() {
    ViewportPool.addOnOpen(() => {
      if (ElementBuilder.#currentSelect)
        ElementBuilder.#currentSelect.setAttribute("data-open", false);
    });
  }

  /**
   * @param {number} min
   * @param {number} max
   * @param {number} value - Default value
   * @param {(value: number): void} onInput - Called when value changes
   * @return {HTMLInputElement}
   */
  static number(min, max, value, onInput) {
    const number = document.createElement("input");
    number.setAttribute("type", "number");
    number.setAttribute("min", min);
    number.setAttribute("max", max);
    number.setAttribute("value", value);
    number.addEventListener("input", () => {
      if (ElementBuilder.#currentSelect)
        ElementBuilder.#currentSelect.setAttribute("data-open", false);
      if (number.validity.valid)
        onInput(number.value);
      else if (number.value > max)
        onInput(max);
      else if (number.value < min)
        onInput(min);
    });
    return number;
  }

  /**
   * @param {[string, string, boolean][]} options - 1. Language code, 2. Native language name, 3. Is Selected
   * @param {(code: string): void} onSelect - Called with new language code when language changed
   * @return {HTMLDivElement}
   */
  static select(options, onSelect) {
    const selectDiv = document.createElement("div")
    selectDiv.classList.add("select");
    selectDiv.setAttribute("data-open", false);

    const labelDiv = document.createElement("div");
    labelDiv.classList.add("label");
    const labelSpan = document.createElement("span");
    labelDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="select-arrow" height="24" viewBox="0 96 960 960" width="24"><path d="M480 711 240 471l43-43 197 198 197-197 43 43-240 239Z"/></svg>`;
    labelDiv.appendChild(labelSpan);
    selectDiv.appendChild(labelDiv);
    labelDiv.addEventListener("click", () => {
      const open = selectDiv.getAttribute("data-open") == "false";

      if (open && ElementBuilder.#currentSelect) {
        ElementBuilder.#currentSelect.setAttribute("data-open", false);
      }

      selectDiv.setAttribute("data-open", open);
      ElementBuilder.#currentSelect = selectDiv;
    });

    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("options");
    for (const [key, value, selected] of options) {
      const optionSpan = document.createElement("span");
      optionSpan.setAttribute("data-open", selected);
      optionSpan.classList.add("option");
      optionSpan.innerText = value; 
      optionsDiv.appendChild(optionSpan);
      optionSpan.addEventListener("click", e => {
        e.stopPropagation();
        optionsDiv.querySelector(`.option[data-open=true]`).setAttribute("data-open", false);
        optionSpan.setAttribute("data-open", true);
        labelSpan.innerText = value;
        selectDiv.setAttribute("data-open", false);
        onSelect(key);
      });

      if (selected)
        labelSpan.innerText = value;
    }
    selectDiv.appendChild(optionsDiv);

    return selectDiv;
  }

  /**
   * @param {string} text
   * @param onClick - Called when button is clicked
   * @return {HTMLButtonElement}
   */ 
  static button(text, onClick) {
    const button = document.createElement("button");
    button.innerText = text;
    button.addEventListener("click", onClick);
    return button;
  }
}

/**
 * Parse '*.viewport' files and set up the resulting
 * dom-output. 
 */ 
class Parser {
  /*
   * Usually has to be called as return statement in child
   * classes.
   * @param {string} source
   * @return {string} Parsed string including native copyright notice
   */ 
  parse(source) {
    const copyrightNotice = `<footer><p>${Language.copyright()}</p></footer>`;
    return source.concat(copyrightNotice);
  }

  /*
   * Usually has to be called as first statement in child
   * classes.
   */
  setup(_) {}
}

/**
 * Data object for handling inner markdown viewport objects
 * like youtube players
 */ 
class MarkdownData {
  #videos = new Array();

  /**
   * Gets called when the markdown viewport setOpen function is called
   * @param {boolean} open
   */
  setOpen(open) {
    if (open)
      this.#videos.forEach(video => video.playVideo ? video.playVideo() : {});
    else
      this.#videos.forEach(video => video.stopVideo());
  }

  /**
   * Called when the markdown viewport destroy function is called
   */ 
  destroy() {
    this.#videos.forEach(video => video.destroy());
  }

  /**
   * @param {YT.Player} video - Video to be registered by the markdown data object
   */ 
  addVideo(video) {
    this.#videos.push(video);
  }
}

/**
 * Parser for markdown-like viewport files
 */ 
class MarkdownParser extends Parser {
  /**
   * @param {string} vrefs - Viewport references
   * @return {string} - Parsed to native html
   */ 
  static #parseVrefs(vrefs) {
    return `<div class="vrefs">
      ${vrefs.replace(/\[(.*)\]\((.*)\)\((.*)\)/g, (_, vrefText, vrefImg, vref) => `
        <figure class="vref" data-href="${vref}">
          <img src="content/${vrefImg}">
          <figcaption>${vrefText}</figcaption>
        </figure>
      `)}
    </div>`;
  }

  /**
   * @param {string} extern - Type of extern media object
   * @param {string} externArgs - Usage defined by extern media object
   * @param {string} media - Usage defined by extern media object
   * @return {string} - Parsed to native html
   */ 
  static #parseExternMedia(extern, externArgs, media) {
    switch (extern) {
      case "yt":
        return `<div
          class="video${externArgs ? ` ${externArgs}` : ""}"
          id="player-${(64 * Math.random()).toString(16)}"
          data-id="${media}"
        ></div>`;
      case "cfg":
        return `<div class="cfg ${media}" data-args="${externArgs}"></div>`;
      default:
        console.error(`Extern partner "${extern}" not supported!`);
        return "";
    }
  }

  /**
   * @param {string} source
   * @return {string} Native html
   */
  parse(source) {
    const regex = /(?:# (.*))|(?:## (.*))|(?:\{([^}]*)\})|(?:!\[{2}(?:([^(\n]*)\(?([^)\n]*)\)?:)?(.*)\]{2})|(^.*)/gm;
    const html = source.replace(regex, (_, h1, h2, vrefs, extern, externArgs, media, p) => {
      if (h1)
        return `<h1>${h1}</h1>`;
      if (h2)
        return `<h2>${h2}</h2>`;
      if (vrefs)
        return MarkdownParser.#parseVrefs(vrefs); 
      if (extern && media) 
        return MarkdownParser.#parseExternMedia(extern, externArgs, media);
      if (media)
        return `<img src="content/${media}">`;
      if (p)
        return `<p>${p.replace(/\[(.*?)\]\((.*?)\)|\*(.*?)\*/g, (_, refText, ref, i) => {
          if (refText && ref)
            return ref.startsWith("http") ?
              `<a href="${ref}" target="_blank">${refText}</a>` :
              `<span class="hyperlink" data-href="${ref}">${refText}</span>`;
          if (i)
            return `<i>${i}</i>`;
        })}</p>`;

      return "";
    });

    return super.parse(html);
  }

  /**
   * @param {HTMLElement} dom -  Viewport article element
   * @return {MarkdownData}
   */
  setup(dom) {
    super.setup(dom);

    const data = new MarkdownData();

    dom.querySelectorAll(".hyperlink, .vref").forEach(link => {
      const id = link.getAttribute("data-href");
      link.addEventListener("click", () => {

        Explorer.openFile(id);
        ViewportPool.open(id, new MarkdownParser());

        if (Nav.getCurrent())
          Nav.getCurrent().setAttribute("data-open", false);
      });
    });

    dom.querySelectorAll(".video").forEach(frame => {
      const id = frame.getAttribute("id");
      const videoId = frame.getAttribute("data-id");
      JobPool.add(async () => {
        const video = new YT.Player(id, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            iv_load_policy: 3,
            loop: 1,
            modestbranding: 1,
            playlist: videoId,
            rel: 0,
            showinfo: 0
          },
          events: {
            onReady: () => {
              video.setPlaybackQuality("hd720")
              data.addVideo(video);
            }
          }
        });
      });
    });

    return data;
  }
}

/**
 * Parser for error codes
 */ 
class ErrorParser extends MarkdownParser {
  #error;

  constructor(error) {
    super();
    this.#error = error;
  }

  /**
   * @param {string} source
   * @return {string}
   */ 
  parse(source) {
    return super.parse(source.concat(`<code>Code: ${this.#error}</code>`));
  }
}

/**
 * Parser for the settings viewport. Primarly consists of the
 * overwritten setup function
 */ 
class SettingsParser extends MarkdownParser {

  /**
   * @param {HTMLElement} dom - Viewport article element
   * @return {MarkdownData}
   */
  setup(dom) {
    const data = super.setup(dom);

    // Language
    const languageDom = dom.querySelector(".cfg.language");
    if (languageDom) {
      const language = ElementBuilder.select(
        Settings.languages().map(([code, lang]) => [code, lang, code == Language.current()]),
        code => {
          Language.set(code);
          ViewportPool.clear();
          ViewportPool.open("settings", new SettingsParser());
          Explorer.init();
        }
      );
      languageDom.after(language);
      languageDom.remove();
    }

    // Color
    const colorDom = dom.querySelector(".cfg.color");
    if (colorDom) {
      const colorNames = new Map();
      colorDom
        .getAttribute("data-args")
        .split(";")
        .map(pair => pair.split(":"))
        .forEach(([key, value]) => colorNames.set(key, value));

      const color = ElementBuilder.select(
        Settings.colors().map(([key, _]) => [key, colorNames.get(key), key == Theme.currentColor()]),
        Theme.setColor
      );
      colorDom.after(color);
      colorDom.remove();
    }

    // Font
    const fontDom = dom.querySelector(".cfg.font");
    if (fontDom) {
      const fonts = ElementBuilder.select(
        Settings.fonts().map(key => [key, key, key == Theme.currentFont()]),
        Theme.setFont
      );
      fontDom.after(fonts);
      fontDom.remove();
    }

    // Font-Size
    const fontSizeDom = dom.querySelector(".cfg.font-size");
    if (fontSizeDom) {
      const fontSize = ElementBuilder.number(8, 24, Theme.currentFontSize(), Theme.setFontSize);
      fontSizeDom.after(fontSize);
      fontSizeDom.remove();
    }

    // Reset
    const resetDom = dom.querySelector(".cfg.reset");
    if (resetDom) {
      const reset = ElementBuilder.button(resetDom.getAttribute("data-args"), () => {
        Theme.default();
        ViewportPool.softReload("settings", new SettingsParser());
      });
      resetDom.after(reset);
      resetDom.remove();
    }

    return data;
  }
}

/*
 * Parser for `explorer.viewport`
 */
class ExplorerParser extends Parser {

  /**
   * @param {string} source
   * @return {string}
   */ 
  parse(source) {
    const regex = /(?:\[(.*)\]\((.*)\)(!)?\s*\{)|(?:\[(.*)\]\((.*)\))|(\})/gm;
    return source.replace(regex, (_, fRefText, fRef, fOpen, refText, ref, fKnee) => {
      if (fRefText && fRef)
        return `
          <div class="folder" data-open="${fOpen == "!"}">
            <div class="folder-header" data-open="false" data-href="${fRef}">
              <svg xmlns="http://www.w3.org/2000/svg" class="folder-arrow" height="24" viewBox="0 96 960 960" width="24"><path d="M480 711 240 471l43-43 197 198 197-197 43 43-240 239Z"/></svg>
              <span>${fRefText}</span>
            </div>
            <div class="folder-content">
        `;
      if (refText && ref)
        return `<span class="file" data-href="${ref}">${refText}</span>`;
      if (fKnee)
        return `</div></div>`;
    });
  }

  /**
   * @param {HTMLElement} dom -  Viewport article element
   * @return {MarkdownData}
   */
  setup(dom) {
    super.setup(dom);

    dom
      .querySelectorAll(".file")
      .forEach(file => file.addEventListener("click", () => {
        const ref = file.getAttribute("data-href");

        Explorer.openFile(ref);
        ViewportPool.open(ref, new MarkdownParser());
      }));

    dom
      .querySelectorAll(".folder")
      .forEach(folder => {
        const header = folder.querySelector(".folder-header");
        const arrow = header.querySelector(".folder-arrow");

        header.addEventListener("click", () => {
          folder.setAttribute("data-open", true);

          const ref = header.getAttribute("data-href");
          Explorer.openFile(ref);
          ViewportPool.open(ref, new MarkdownParser());
        });

        arrow.addEventListener("click", e => {
          e.stopPropagation();
          folder.setAttribute("data-open", folder.getAttribute("data-open") == "false");
        });
      });
  }
}

/**
 * Represents a page in the viewer, witch gets displayed in
 * the editor.
 */
class Viewport {
  #dom;
  #data;

  constructor(id) {
    const dom = document.createElement("article");
    dom.setAttribute("data-open", false);
    dom.setAttribute("data-id", id);
    this.#dom = dom;
  }

  /**
   * @param {string} source
   * @param {Parser} parser
   */ 
  async load(source, parser) {
    const raw = await source.text();
    this.#dom.innerHTML = parser.parse(raw);
    this.#data = parser.setup(this.#dom);
  }

  /**
   * Links this viewport to the application
   * @param {HTMLElement} editor - DOM Element of the editor
   */ 
  link(editor) {
    editor.appendChild(this.#dom);
  }

  /**
   * Removes everything (including memory) of this viewport
   */
  destroy() {
    this.#dom.remove();
    if (this.#data)
      this.#data.destroy();
  }

  /**
   * @param {boolean} open - Reveals viewport if true, else hides it
   */
  setOpen(open) {
    this.#dom.setAttribute("data-open", open);
    if (this.#data)
      this.#data.setOpen(open);
  }

  /**
   * @return {string} Viewport id
   */ 
  getId() {
    return this.#dom.getAttribute("data-id");
  }
}

/**
 * Loads viewports into the dom and keeps track of them.
 */
class ViewportPool {
  static #viewports = new Map();
  static #current = null;
  static #editor = document.getElementById("Editor");

  static #onOpen = new Array();

  /**
   * @param {(viewport: Viewport): void} fn - Called whenever a viewport gets opened up
   */ 
  static addOnOpen(fn) {
    ViewportPool.#onOpen.push(fn);
  }

  /**
   * Loads Viewport into memory and reveals it to the user
   *
   * @param {string} id - See 'ViewportPool.load'
   * @param {Parser} parser - See 'ViewportPool.load'
   */ 
  static open(id, parser) {
    JobPool.add(async () => {

      // Hide the explorer at every page load on mobile
      if (Settings.isMobile())
        Explorer.setOpen(false);

      // Load if viewport is not loaded yet
      // In both cases hide the current viewport
      if (!ViewportPool.#viewports.has(id))
        await ViewportPool.#load(id, parser);
      else
        ViewportPool.#current.setOpen(false);

      ViewportPool.#current = ViewportPool.#viewports.get(id);
      ViewportPool.#current.setOpen(true);
      ViewportPool.#editor.scrollTo(0, 0);

      ViewportPool.#onOpen.forEach(fn => fn(ViewportPool.#current));
    });
  }

  /**
   * Loads viewport into memory
   *
   * @param {string} id - Viewport id to be opened
   * @param {Parser} parser - Parser with which the correlating *.viewport file should be parsed
   */ 
  static load(id, parser) {
    JobPool.add(async () => ViewportPool.#load(id, parser));
  }

  /**
   * Reloads memory of already loaded Viewport from scratch
   *
   * @param {string} id - See 'ViewportPool.load'
   * @param {Parser} parser - See 'ViewportPool.load'
   */ 
  static softReload(id, parser) {
    JobPool.add(async () => {
      const source = Source.open(`${Language.path()}/${id}.viewport`);
      await ViewportPool.#current.load(source, parser);
    });
  }

  /**
   * Destroys all viewports and frees its memory
   */
  static clear() {
    JobPool.add(async () => {
      ViewportPool.#viewports.forEach(viewport => viewport.destroy());
      ViewportPool.#viewports = new Map()
    });
  }

  /**
   * @param {string} id - See 'ViewportPool.load'
   * @param {Parser} parser - See 'ViewportPool.load'
   */ 
  static async #load(id, parser) {
    const viewport = new Viewport(id);
    const source = Source.open(`${Language.path()}/${id}.viewport`);
    await viewport.load(source, parser);

    if (ViewportPool.#current)
      ViewportPool.#current.setOpen(false);

    viewport.link(ViewportPool.#editor);

    ViewportPool.#viewports.set(id, viewport);
  }

  /**
   * @return {string} Viewport id of the currently opened viewport
   */ 
  static getCurrentId() {
    return ViewportPool.#current.getId();
  }
}

/**
 * Manages the explorer containing the project viewports
 */
class Explorer {
  static #explorer = document.getElementById("Explorer");
  static #currentFile = null;
  static onOpen;

  /**
   * Has to be called once before usage
   */
  static init() {
    JobPool.add(async () => {
      const source = Source.open(`${Language.path()}/explorer.viewport`);
      const parser = new ExplorerParser();
      Explorer.#explorer.innerHTML = parser.parse(await source.text());
      parser.setup(Explorer.#explorer);
    }); 
  }

  /**
   * @return {boolean} true if explorer is visible
   */ 
  static isOpen() {
    return Explorer.#explorer.getAttribute("data-open") == "true";
  }
 
  /**
   * Visually opens the specified file and all its parent folders
   *
   * @param {boolean} open - Reveals the explorer to the user if true, else hides it
   */ 
  static setOpen(open) {
    Explorer.#explorer.setAttribute("data-open", open);
    Explorer.onOpen(open);
  }

  /**
   * @param {string} id
   */ 
  static openFile(id) {
    const file = Explorer.#explorer.querySelector(`[data-href=${id}]`);
    if (file) {
      if (Explorer.#currentFile !== null)
        Explorer.#currentFile.setAttribute("data-open", false);

      file.setAttribute("data-open", true);

      // Function to search for all parent folders and open them up
      const openFolders = f => {
        if (f.parentNode.classList.contains("folder-content")) {
          openFolders(f.parentNode.parentNode);
        }
        f.setAttribute("data-open", true);
      };

      openFolders(file);
    }

    Explorer.#currentFile = file;
  }

  /**
   * Visually closes current file
   */ 
  static closeCurrentFile() {
    if (Explorer.#currentFile === null)
      return;

    Explorer.#currentFile.setAttribute("data-open", false);
    Explorer.#currentFile = null;
  }
}

/**
 * Manages the navigation buttons on the left side
 */ 
class Nav {
  static #home = document.getElementById("NavHome");
  static #explorer = document.getElementById("NavExplorer");
  static #about = document.getElementById("NavAbout");
  static #contact = document.getElementById("NavContact");
  static #copyright = document.getElementById("NavCopyright");
  static #settings = document.getElementById("NavSettings");
  static #current = null;

  /**
   * Has to be called once before usage
   */
  static init() {
    // Setup home button
    Nav.#home.addEventListener("click", () => {
      Explorer.closeCurrentFile();
      Explorer.setOpen(false);
      ViewportPool.open("home", new MarkdownParser());
    });

    // Setup about button
    Nav.#about.addEventListener("click", () => {
      Explorer.closeCurrentFile();
      Explorer.setOpen(false);
      ViewportPool.open("about", new MarkdownParser());
    });

    // Setup contact button
    Nav.#contact.addEventListener("click", () => {
      Explorer.closeCurrentFile();
      Explorer.setOpen(false);
      ViewportPool.open("contact", new MarkdownParser());
    });

    // Setup copyright button
    Nav.#copyright.addEventListener("click", () => {
      Explorer.closeCurrentFile();
      Explorer.setOpen(false);
      ViewportPool.open("copyright", new MarkdownParser());
    });

    // Setup settings button
    Nav.#settings.addEventListener("click", () => {
      Explorer.closeCurrentFile();
      Explorer.setOpen(false);
      ViewportPool.open("settings", new SettingsParser());
    });

    // Setup explorer button
    Nav.#explorer.addEventListener("click", () => {
      const newState = !Explorer.isOpen();

      // If explorer was closed and is now opening again
      if (newState) {
        Explorer.openFile("projects");
        ViewportPool.open("projects", new MarkdownParser());
      }

      JobPool.add(async () => Explorer.setOpen(newState));
    });
    Explorer.onOpen = open => Nav.#explorer.setAttribute("data-open", open);

    ViewportPool.addOnOpen(v => {
      switch (v.getId()) {
        case "home":
          if (Nav.#current !== null)
            Nav.#current.setAttribute("data-open", false);

          Nav.#current = Nav.#home;
          Nav.#current.setAttribute("data-open", true);

          break;
        case "about":
          if (Nav.#current !== null)
            Nav.#current.setAttribute("data-open", false);

          Nav.#current = Nav.#about;
          Nav.#current.setAttribute("data-open", true);

          break;
        case "contact":
          if (Nav.#current !== null)
            Nav.#current.setAttribute("data-open", false);

          Nav.#current = Nav.#contact;
          Nav.#current.setAttribute("data-open", true);

          break;
        case "copyright":
          if (Nav.#current !== null)
            Nav.#current.setAttribute("data-open", false);

          Nav.#current = Nav.#copyright;
          Nav.#current.setAttribute("data-open", true);

          break;
        case "settings":
          if (Nav.#current !== null)
            Nav.#current.setAttribute("data-open", false);

          Nav.#current = Nav.#settings;
          Nav.#current.setAttribute("data-open", true);

          break;
        default:
          if (Nav.#current === null)
            break;

          Nav.#current.setAttribute("data-open", false);
          Nav.#current = null

          break;
      }
    });
  }

  static getCurrent() {
    return Nav.#current;
  }
}

class Tutorial {
  static #button = document.getElementById("PortfolioViewerHelp");

  /**
   * @param {boolean} open
   */ 
  static setOpen(open) {
    Tutorial.#button.setAttribute("data-open", open);
  }
}

/**
 * Loads extern api dependencies by inserting a script tag
 * into the head of the dom.
 */ 
function loadAPI(src) {
  const tag = document.createElement("script");
  tag.src = src;
  const script1 = document.getElementsByTagName("script")[0];
  script1.parentNode.insertBefore(tag, script1);
}

/**
 * Entry point
 */ 
(async () => {
  loadAPI("https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js");
  loadAPI("https://www.youtube.com/iframe_api");
  
  ElementBuilder.init();
  Settings.init();

  ViewportPool.addOnOpen(v => Settings.setLink(v.getId()));
  
  Language.set(User.preferedLanguage());
  Theme.setColor(User.preferedColor());
  Theme.setFontSize(User.preferedFontSize());
  Theme.setFont(User.preferedFont());

  Nav.init();
  Explorer.init();

  Tutorial.setOpen(!User.tutorialized());

  // Turn on the Job Pool
  setInterval(JobPool.exec);
  
  // Open viewport depending on the current link
  const link = Settings.getLink();
  switch (link) {
    case null:
    case "home":
    case "error":
    case "settings":
      ViewportPool.open("home", new MarkdownParser());
      break;
    default:
      ViewportPool.open(link, new MarkdownParser());
      break;
  }
})();

