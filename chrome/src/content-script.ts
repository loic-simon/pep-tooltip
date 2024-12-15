// ================================
// Type-only stuff, not in JS files
// ================================

declare const tippy: import("tippy.js").Tippy;

type PEPInfo = {
  // Schema from https://peps.python.org/api/
  number: number;
  title: string;
  authors: string;
  discussions_to: string | null;
  status:
    | "Accepted"
    | "Active"
    | "Deferred"
    | "Draft"
    | "Final"
    | "Provisional"
    | "Rejected"
    | "Superseded"
    | "Withdrawn";
  type: "Informational" | "Process" | "Standards Track";
  topic: "governance" | "packaging" | "release" | "typing" | "";
  created: string;
  python_version: string | null;
  post_history: string;
  resolution: string | null;
  requires: string | null;
  replaces: string | null;
  superseded_by: string | null;
  url: string;
};

type HTMLString = {
  content: string;
};

// =================
// Various constants
// =================

const PEPS_API_URL = "https://peps.python.org/api/peps.json";

const WEBSTORE_URL = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}`;
const GITHUB_URL = "https://github.com/loic-simon/pep-tooltip";

const INFO_ICON_TEXT = "\u{2139}\u{FE0F}"; // Information Source emoji
const LINK_SVG_PATH =
  "M10.0002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002V15.8002C5 16.9203 5 17.4801 5.21799 17.9079C5.40973 18.2842 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8031C16.921 19 17.48 19 17.9074 18.7822C18.2837 18.5905 18.5905 18.2839 18.7822 17.9076C19 17.4802 19 16.921 19 15.8031V14M20 9V4M20 4H15M20 4L13 11";

const TOOLTIP_ADDED_ATTRIBUTE = "data-pep-tooltip-added";

// ================
// Poor man's store
// ================

var PEPS_DATA: Record<string, PEPInfo> = {};

// ====================================================
// Home-made mini-HTML template system, because why not
// ====================================================

// From https://stackoverflow.com/a/6234804
const _escape = (unsafe: string) =>
  unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const _htmlParamToString = (param: HTMLString | string | null) =>
  typeof param === "object" ? param?.content ?? "" : _escape(param);

const html = (texts: TemplateStringsArray, ...params: (HTMLString | string | null)[]): HTMLString => ({
  content: texts
    .reduce<string[]>(
      (parts, text, i) => [...parts, text, ...(params[i] !== undefined ? [_htmlParamToString(params[i])] : [])],
      []
    )
    .join(""),
});

const joinHTML = (texts: HTMLString[], separator: HTMLString): HTMLString => ({
  content: texts.map((string) => string.content).join(separator.content),
});

// ================
// Tooltip creation
// ================

const pepNumbersField = (commaSeparatedNumbers: string) =>
  joinHTML(
    commaSeparatedNumbers
      .split(", ")
      .map((pepNumber) => ({ pepNumber, pepData: PEPS_DATA[pepNumber] }))
      .map(({ pepNumber, pepData }) =>
        pepData
          ? html`<a href="${pepData.url}" title="${pepData.title}" target="_blank">PEP ${pepNumber}</a>`
          : html`PEP ${pepNumber}`
      ),
    html`, `
  );

const buildTooltip = (header: HTMLString, content: HTMLString) =>
  html`<div class="pep-tooltip-contents">
    <div class="pep-tooltip-header">${header}</div>
    <hr />
    <div class="pep-tooltip-body">${content}</div>
    <hr />
    <div class="pep-tooltip-footer">
      <span>Provided by <a href="${WEBSTORE_URL}">PEP Tooltip extension</a></span> &bull;
      <span>Contribute on <a href="${GITHUB_URL}">GitHub</a>!</span>
    </div>
  </div>`.content;

const getTooltipContents = (pepNumber: string) => {
  const pepData = PEPS_DATA[pepNumber];
  if (!pepData)
    return buildTooltip(
      html`PEP ${pepNumber} – <b> ?</b>`,
      html`<i>No information on this PEP found.<br />Maybe it is not merged yet?</i>`
    );

  return buildTooltip(
    html`
      <div>PEP ${pepNumber} – <b>${pepData.title}</b></div>
      <div class="pep-tooltip-open-button">
        <svg width="20px" height="20px" viewBox="1 -2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="${LINK_SVG_PATH}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <a href="${pepData.url}" target="_blank">
          <!-- Link on the whole div, cf. https://stackoverflow.com/a/3494108 -->
          <span class="pep-tooltip-open-button-link"></span>
        </a>
      </div>
    `,
    html`
      <dl>
        <dt>Author${pepData.authors.includes(",") ? "s" : ""}:</dt>
        <dd>${pepData.authors}</dd>
        <dt>Status:</dt>
        <dd>${pepData.status}</dd>
        <dt>Type:</dt>
        <dd>${pepData.type}</dd>
        <dt>Created:</dt>
        <dd>${pepData.created}</dd>
        ${pepData.python_version &&
        html`
          <dt>Python-Version:</dt>
          <dd>${pepData.python_version}</dd>
        `}
        ${pepData.requires &&
        html`
          <dt>Requires:</dt>
          <dd>${pepNumbersField(pepData.requires)}</dd>
        `}
        ${pepData.replaces &&
        html`
          <dt>Replaces:</dt>
          <dd>${pepNumbersField(pepData.replaces)}</dd>
        `}
        ${pepData.superseded_by &&
        html`
          <dt>Superseded-By:</dt>
          <dd>${pepNumbersField(pepData.superseded_by)}</dd>
        `}
      </dl>
    `
  );
};

const getTooltipNode = (pepNumber: string) => {
  // Create wrapper span containing trigger icon + tooltip contents
  const wrapperNode = document.createElement("span");
  wrapperNode.setAttribute("class", "pep-tooltip-wrapper");

  // Create trigger icon
  const infoNode = document.createElement("span");
  infoNode.setAttribute("class", "pep-tooltip-icon");
  infoNode.append(INFO_ICON_TEXT);

  // Attach Tippy tooltip to it
  tippy(infoNode, {
    content: getTooltipContents(pepNumber),
    allowHTML: true,
    interactive: true,
    popperOptions: { strategy: "fixed" },
    // trigger: "click", // Uncomment for easier debugging
  });

  wrapperNode.appendChild(infoNode);
  return wrapperNode;
};

// ==============================
// DOM processing to add tooltips
// ==============================

const pepTextToNodes = (content: string, keepText: boolean = true) =>
  content.split(/(PEP \d+)/gi).reduce<Node[]>((acc, part) => {
    const match = part.match(/PEP (\d+)/i);
    return [...acc, ...(keepText ? [new Text(part)] : []), ...(match ? [getTooltipNode(match[1]!)] : [])];
  }, []);

const processElement = (node: Element) => {
  if (node.getAttribute(TOOLTIP_ADDED_ATTRIBUTE)) {
    // Node already processed
    return;
  }
  if (node.innerHTML.search(/PEP \d+/i) < 0) {
    // Node does not contains "PEP xxx" pattern
    return;
  }
  if (node.getAttribute("role") === "tooltip")
    // Do not insert tooltip in tooltips (eg. footnotes)  // FIXME: not working
    return;
  if (node.childNodes.length) {
    // Not a terminal node: process children
    let appendAtNodeEnd = "";
    Array.from(node.childNodes).forEach((child) => {
      if (child instanceof Element) processElement(child);
      if (child instanceof Text && child.data.search(/PEP \d+/i) >= 0) {
        // Raw text node containing at least one "PEP xxx" pattern
        if (node.tagName === "A") {
          // Link: put tooltips after the <a />, so they are not a link
          appendAtNodeEnd += child.data;
        } else {
          // Other node: add tooltip inline inline
          child.replaceWith(...pepTextToNodes(child.data));
        }
        node.setAttribute(TOOLTIP_ADDED_ATTRIBUTE, "true"); // Mark node as processed
      }
    });
    if (appendAtNodeEnd) node.replaceWith(node, ...pepTextToNodes(appendAtNodeEnd, false));
    return;
  }
  // Terminal node containing at least one "PEP xxx" pattern
  node.setAttribute(TOOLTIP_ADDED_ATTRIBUTE, "true"); // Mark node as processed
  node.replaceChildren(...pepTextToNodes(node.innerHTML));
};

// =======
// Runtime
// =======

// Get PEPs data (needed first to build tooltips; maybe switch to some shiny lazy system some day...)
fetch(PEPS_API_URL)
  .then((resp) => resp.json())
  .catch((err) => console.error("PEP-tooltip: unable to get PEP data:", err))
  .then((data) => {
    if (!data) return; // .catch triggered
    PEPS_DATA = data;

    // Watch for messages loaded when scrolling
    const observer = new MutationObserver((records) => {
      console.log("PEP-tooltip: processing newly loaded messages...");
      records.forEach((record) => {
        Array.from(record.addedNodes)
          .filter((node) => node instanceof Element)
          .forEach((node) => processElement(node));
      });
    });
    Array.from(document.getElementsByClassName("post-stream")).forEach((postStream) => {
      observer.observe(postStream, { childList: true });
    });

    // Process messages initially loaded when script runs
    console.log("PEP-tooltip: processing initial messages...");
    Array.from(document.getElementsByClassName("topic-post")).forEach((node) => processElement(node));
  });
