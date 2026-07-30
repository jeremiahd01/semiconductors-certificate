const state = {
  courses: [],
  filteredCourses: [],
  selectedCourseIds: new Set(),
  plannerCredits: {},
  skillToTopic: new Map(),
  skillToCategory: new Map(),
  topicToCategory: new Map(),
  topicIdToName: new Map(),
  categoryColorIndex: new Map(),
};

const refs = {
  fileInput: document.getElementById("fileInput"),
  clearDataBtn: document.getElementById("clearDataBtn"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  resetPlanBtn: document.getElementById("resetPlanBtn"),
  loadStatus: document.getElementById("loadStatus"),
  courseLevelFilter: document.getElementById("courseLevelFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  topicFilter: document.getElementById("topicFilter"),
  skillFilter: document.getElementById("skillFilter"),
  searchFilter: document.getElementById("searchFilter"),
  resultCount: document.getElementById("resultCount"),
  courseTableBody: document.getElementById("courseTableBody"),
  selectedCourses: document.getElementById("selectedCourses"),
  creditSummary: document.getElementById("creditSummary"),
  categorySummary: document.getElementById("categorySummary"),
  requirementStatus: document.getElementById("requirementStatus"),
};

const OVERVIEW_SHEET_NAME = "Overview";
const TOPICS_SHEET_NAME = "Category & Topics";
const TOPIC_IDS_SHEET_NAME = "Topic IDs";
const BADGE_COLOR_CLASSES = 8;
const DEFAULT_WORKBOOK_URL = "https://engineering.purdue.edu/MTEC/WebTools/SemiconductorCertificate/SemiconductorSpreadsheet";
const CATALOG_TERM = "202620";
const CATALOG_DETAIL_URL = "https://selfservice.mypurdue.purdue.edu/prod/bwckctlg.p_disp_course_detail";

let activeCatalogPopover = null;
let activeCatalogTrigger = null;

function normalize(value) {
  return String(value || "").trim();
}

function toLower(value) {
  return normalize(value).toLowerCase();
}

function parseNumericCredits(value) {
  const raw = normalize(value);
  if (!raw) return 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function hasSpreadsheetCreditValue(value) {
  return normalize(value) !== "";
}

function isNumericLike(value) {
  const raw = normalize(value);
  return /^-?\d+(\.\d+)?$/.test(raw);
}

function extractCourseLevel(courseNumber) {
  const raw = normalize(courseNumber);
  if (!raw) return "";
  
  // Extract all digits from the course number and get the first digit
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  
  const firstDigit = digits.charAt(0);
  const level = firstDigit + "00-level";
  return level;
}

function parseCatalogCourseParts(courseNumber) {
  const raw = normalize(courseNumber);
  if (!raw) return null;

  const match = raw.match(/([A-Za-z]{2,4})\s*(\d{3,5})/);
  if (!match) return null;

  return {
    subject: match[1].toUpperCase(),
    number: match[2],
  };
}

function buildCatalogUrl(courseNumber) {
  const parts = parseCatalogCourseParts(courseNumber);
  if (!parts) return "";

  const normalizedCourseNumber = parts.number.length === 3 ? `${parts.number}00` : parts.number;

  const params = new URLSearchParams({
    cat_term_in: CATALOG_TERM,
    subj_code_in: parts.subject,
    crse_numb_in: normalizedCourseNumber,
  });

  return `${CATALOG_DETAIL_URL}?${params.toString()}`;
}

function catalogButtonMarkup(courseNumber) {
  const url = buildCatalogUrl(courseNumber);
  if (!url) return "";
  return `<div style="margin-top: 0.3rem;"><a class="catalog-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Catalog</a></div>`;
}

function closeCatalogPopover() {
  if (!activeCatalogPopover) return;
  activeCatalogPopover.remove();
  activeCatalogPopover = null;
  activeCatalogTrigger = null;
}

function positionCatalogPopover(popover, trigger) {
  const triggerRect = trigger.getBoundingClientRect();
  const viewportPadding = 12;
  const popoverWidth = 700;
  const popoverHeight = 420;

  let left = triggerRect.left;
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - popoverWidth - viewportPadding));

  let top = triggerRect.bottom + 8;
  if (top + popoverHeight > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, triggerRect.top - popoverHeight - 8);
  }

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function openCatalogPopover(trigger, url) {
  closeCatalogPopover();

  const popover = document.createElement("div");
  popover.className = "catalog-popover";
  popover.innerHTML = `
    <div class="catalog-popover-header">
      <strong>Catalog Preview</strong>
      <button class="secondary" type="button" data-close-catalog-popover>Close</button>
    </div>
    <iframe class="catalog-popover-frame" src="${escapeHtml(url)}" loading="lazy" referrerpolicy="no-referrer"></iframe>
    <div class="catalog-popover-footer">
      <a class="catalog-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open in new tab</a>
    </div>
  `;

  document.body.appendChild(popover);
  activeCatalogPopover = popover;
  activeCatalogTrigger = trigger;
  positionCatalogPopover(popover, trigger);
}

function handleCatalogInteractions(event) {
  const closeButton = event.target.closest("[data-close-catalog-popover]");
  if (closeButton) {
    closeCatalogPopover();
    return;
  }

  const catalogLink = event.target.closest("a.catalog-link");
  if (catalogLink && catalogLink.closest(".catalog-popover")) {
    return;
  }

  if (catalogLink) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    const url = catalogLink.getAttribute("href");
    if (!url) return;

    if (activeCatalogPopover && activeCatalogTrigger === catalogLink) {
      closeCatalogPopover();
      return;
    }

    openCatalogPopover(catalogLink, url);
    return;
  }

  if (activeCatalogPopover && !activeCatalogPopover.contains(event.target)) {
    closeCatalogPopover();
  }
}

function handleCatalogEscape(event) {
  if (event.key === "Escape") {
    closeCatalogPopover();
  }
}

function handleCatalogPopoverResize() {
  if (activeCatalogPopover && activeCatalogTrigger) {
    positionCatalogPopover(activeCatalogPopover, activeCatalogTrigger);
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCourseDisplayName(courseName, courseNumber) {
  const rawName = normalize(courseName);
  const rawNumber = normalize(courseNumber);
  if (!rawName) return "";
  if (!rawNumber) return rawName;

  if (/^VIP\b/i.test(rawNumber) && !/\d/.test(rawNumber)) {
    return rawName;
  }

  const numberParts = rawNumber
    .split("/")
    .map((part) => normalize(part))
    .filter((part) => part)
    .map((part) => escapeRegex(part).replace(/\\ /g, "\\s+"));

  if (numberParts.length) {
    const numberPrefixPattern = new RegExp(`^${numberParts.join("\\s*\\/\\s*")}\\s*(?:[-:–—]\\s*)?`, "i");
    const strippedByNumber = rawName.replace(numberPrefixPattern, "").trim();
    if (strippedByNumber && strippedByNumber !== rawName) {
      return strippedByNumber;
    }
  }

  const strippedMultiCode = rawName
    .replace(/^(?:[A-Za-z]{2,4}\s*\d{3,5})(?:\s*\/\s*[A-Za-z]{2,4}\s*\d{3,5})+\s*(?:[-:–—]\s*)?/i, "")
    .trim();
  if (strippedMultiCode && strippedMultiCode !== rawName) {
    return strippedMultiCode;
  }

  const strippedSingleCode = rawName
    .replace(/^[A-Za-z]{2,4}\s*\d{3,5}\s*(?:[-:–—]\s*)?/i, "")
    .trim();

  return strippedSingleCode || rawName;
}

function topicLookupKeys(value) {
  const raw = normalize(value);
  if (!raw) return [];

  const keys = new Set([raw, raw.toLowerCase()]);
  if (raw.includes(".")) {
    const trimmedDecimal = raw.replace(/\.0+$/, "");
    if (trimmedDecimal) {
      keys.add(trimmedDecimal);
      keys.add(trimmedDecimal.toLowerCase());
    }
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const numericKey = String(numeric);
    keys.add(numericKey);
    keys.add(numericKey.toLowerCase());
  }

  return [...keys];
}

function resolveTopicName(topicValue, topicIdToName) {
  const raw = normalize(topicValue);
  if (!raw) return "Unspecified Topic";

  // Special case: topic 17 is always "Workforce Development"
  const keys = topicLookupKeys(raw);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === "17" || parseFloat(key) === 17) {
      return "Workforce Development";
    }
    if (topicIdToName.has(key)) {
      const resolved = topicIdToName.get(key);
      if (resolved === "17" || String(resolved) === "17") {
        return "Workforce Development";
      }
      return resolved;
    }
  }

  // If topic is 17, return "Workforce Development"
  if (raw === "17" || parseFloat(raw) === 17) {
    return "Workforce Development";
  }

  return raw;
}

function findWorkbookSheet(workbook, preferredName, aliases = []) {
  const allNames = workbook.SheetNames || [];
  const normalizedPreferred = toLower(preferredName);

  const exact = allNames.find((name) => toLower(name) === normalizedPreferred);
  if (exact) return workbook.Sheets[exact];

  const normalizedAliases = aliases.map((alias) => toLower(alias));
  const aliasMatch = allNames.find((name) => {
    const normalizedName = toLower(name);
    return normalizedAliases.some((alias) => normalizedName === alias || normalizedName.includes(alias));
  });
  if (aliasMatch) return workbook.Sheets[aliasMatch];

  return undefined;
}

function findHeaderRow(rows, requiredChecks) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const rowStrings = row.map((cell) => toLower(cell));
    const score = requiredChecks.reduce((acc, check) => (check(rowStrings) ? acc + 1 : acc), 0);
    if (score >= Math.max(2, requiredChecks.length - 1)) {
      return index;
    }
  }
  return -1;
}

function headerIndexMap(headerRow) {
  const map = new Map();
  headerRow.forEach((value, index) => {
    const key = toLower(value);
    if (key) {
      map.set(key, index);
    }
  });
  return map;
}

function findColumn(headerRow, fallbackIndex, searchTerms) {
  const lowerHeaders = headerRow.map((item) => toLower(item));
  for (let index = 0; index < lowerHeaders.length; index += 1) {
    const header = lowerHeaders[index];
    if (!header) continue;
    if (searchTerms.some((term) => header.includes(term))) {
      return index;
    }
  }
  return fallbackIndex;
}

function mapLookup(map, key) {
  const raw = normalize(key);
  if (!raw) return "";
  return map.get(raw) || map.get(toLower(raw)) || "";
}

function parseTopicIdsSheet(rows) {
  const checks = [
    (cells) => cells.some((cell) => cell.includes("topic")),
    (cells) => cells.some((cell) => cell.includes("id") || cell.includes("number")),
    (cells) => cells.some((cell) => cell.includes("name") || cell.includes("title") || cell.includes("description")),
  ];

  const headerRowIndex = findHeaderRow(rows, checks);
  const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const header = headerRowIndex >= 0 ? rows[headerRowIndex] || [] : [];

  let topicIdIndex = findColumn(header, 0, ["topic id", "topic #", "id", "number"]);
  let topicNameIndex = findColumn(header, 1, ["topic name", "topic", "name", "title", "description"]);
  if (topicIdIndex === topicNameIndex) {
    topicNameIndex = topicIdIndex === 0 ? 1 : 0;
  }

  const topicIdToName = new Map();

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index] || [];
    let topicId = normalize(row[topicIdIndex]);
    let topicName = normalize(row[topicNameIndex]);

    if (!topicName) {
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (columnIndex === topicIdIndex) continue;
        const candidate = normalize(row[columnIndex]);
        if (candidate) {
          topicName = candidate;
          break;
        }
      }
    }

    if (topicId && topicName && !isNumericLike(topicId) && isNumericLike(topicName)) {
      const swappedId = topicName;
      topicName = topicId;
      topicId = swappedId;
    }

    if (!topicId || !topicName) continue;

    const keys = topicLookupKeys(topicId);
    keys.forEach((key) => {
      topicIdToName.set(key, topicName);
    });
  }

  if (topicIdToName.size === 0) {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || [];
      let idCandidate = "";
      let nameCandidate = "";

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const value = normalize(row[columnIndex]);
        if (!value) continue;
        if (!idCandidate && isNumericLike(value)) {
          idCandidate = value;
          continue;
        }
        if (!nameCandidate && !isNumericLike(value)) {
          nameCandidate = value;
        }
      }

      if (!idCandidate || !nameCandidate) continue;
      topicLookupKeys(idCandidate).forEach((key) => {
        topicIdToName.set(key, nameCandidate);
      });
    }
  }

  return topicIdToName;
}

function parseTopicsSheet(rows, topicIdToName = new Map()) {
  const checks = [
    (cells) => cells.some((cell) => cell.includes("skill")),
    (cells) => cells.some((cell) => cell.includes("topic")),
    (cells) => cells.some((cell) => cell.includes("category")),
  ];

  const headerRowIndex = findHeaderRow(rows, checks);
  if (headerRowIndex < 0) {
    return {
      skillToTopic: new Map(),
      skillToCategory: new Map(),
      topicToCategory: new Map(),
    };
  }

  const header = rows[headerRowIndex] || [];

  let skillIndex = 0; // Column A: Skillset
  let categoryIndex = 2; // Column C: Category
  let topicIndex = 4; // Column E: Topic

  const hasAceData = rows.slice(headerRowIndex + 1).some((row) => normalize(row?.[0]) || normalize(row?.[2]) || normalize(row?.[4]));
  if (!hasAceData) {
    skillIndex = findColumn(header, 0, ["skill"]);
    topicIndex = findColumn(header, 1, ["topic"]);
    categoryIndex = findColumn(header, 2, ["category", "certificate", "area"]);
  }

  const skillToTopic = new Map();
  const skillToCategory = new Map();
  const topicToCategory = new Map();

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const skill = normalize(row[skillIndex]);
    if (!skill) continue;

    const rawTopic = normalize(row[topicIndex]);
    const topic = resolveTopicName(rawTopic, topicIdToName);
    const category = normalize(row[categoryIndex]) || "Uncategorized";

    skillToTopic.set(skill, topic);
    skillToTopic.set(toLower(skill), topic);
    skillToCategory.set(skill, category);
    skillToCategory.set(toLower(skill), category);

    const topicKey = normalize(topic);
    const topicLowerKey = toLower(topic);
    if (!topicToCategory.has(topicKey) && !topicToCategory.has(topicLowerKey)) {
      topicToCategory.set(topicKey, category);
      topicToCategory.set(topicLowerKey, category);
    }
  }

  return {
    skillToTopic,
    skillToCategory,
    topicToCategory,
  };
}

function parseOverviewSheet(rows, skillToTopic, skillToCategory, topicToCategory) {
  const checks = [
    (cells) => cells.some((cell) => cell.includes("course") && cell.includes("number")),
    (cells) => cells.some((cell) => cell.includes("course") && (cell.includes("name") || cell.includes("title"))),
    (cells) => cells.some((cell) => cell.includes("category")),
  ];

  let headerRowIndex = findHeaderRow(rows, checks);
  if (headerRowIndex < 0) {
    headerRowIndex = 4;
  }

  const header = rows[headerRowIndex] || [];
  const headerMap = headerIndexMap(header);

  const categoryIndex = findColumn(header, 2, ["primary category", "certificate category", "category"]);
  const courseNumberIndex = findColumn(header, 3, ["course number"]);
  const courseNameIndex = findColumn(header, 4, ["course name", "title"]);
  const status2627Index = findColumn(header, 0, ["2026", "status"]);
  const status2728Index = findColumn(header, 1, ["2027", "plan"]);
  const repIndex = findColumn(header, 6, ["representative", "added by", "rep"]);

  let creditIndex = -1;
  for (const [key, index] of headerMap.entries()) {
    if (key.includes("credit")) {
      creditIndex = index;
      break;
    }
  }

  const skillColumns = [];
  const startSkillIndex = 7;
  for (let i = startSkillIndex; i < header.length; i += 1) {
    const skillName = normalize(header[i]);
    if (!skillName) continue;
    skillColumns.push({ index: i, name: skillName });
  }

  const courses = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];

    const courseNumber = normalize(row[courseNumberIndex]);
    const courseName = normalize(row[courseNameIndex]);
    if (!courseNumber && !courseName) continue;

    const displayCourseName = formatCourseDisplayName(courseName, courseNumber);

    const category = normalize(row[categoryIndex]) || "Uncategorized";
    const status2627 = normalize(row[status2627Index]);
    const statusDecision = toLower(status2627);
    const includeInPlanner = statusDecision === "keep" || statusDecision === "add";
    if (!includeInPlanner) continue;

    const status2728 = normalize(row[status2728Index]);
    const representative = normalize(row[repIndex]);
    const creditCellValue = creditIndex >= 0 ? row[creditIndex] : "";
    const hasSpreadsheetCredits = hasSpreadsheetCreditValue(creditCellValue);
    const credits = hasSpreadsheetCredits ? parseNumericCredits(creditCellValue) : 0;

    const skills = [];
    const topics = new Set();
    const topicCategoryMap = new Map();

    skillColumns.forEach((column) => {
      const marker = toLower(row[column.index]);
      if (marker === "x" || marker === "1" || marker === "yes") {
        skills.push(column.name);
        const topic = skillToTopic.get(column.name) || "Unspecified Topic";
        const skillCategory =
          mapLookup(skillToCategory, column.name) || mapLookup(topicToCategory, topic) || category || "Uncategorized";

        topics.add(topic);
        if (!topicCategoryMap.has(topic)) {
          topicCategoryMap.set(topic, skillCategory);
        }
      }
    });

    const id = `${courseNumber}__${courseName}`;

    courses.push({
      id,
      courseNumber,
      courseName: displayCourseName,
      category,
      courseLevel: extractCourseLevel(courseNumber),
      status2627,
      status2728,
      representative,
      credits,
      hasSpreadsheetCredits,
      skills,
      topics: [...topics],
      topicCategories: Object.fromEntries(topicCategoryMap),
    });
  }

  return courses;
}

function getCoursesMatchingFilters({ courseLevel = "", category = "", topic = "", skill = "", search = "" } = {}) {
  return state.courses.filter((course) => {
    const courseLevelMatch = !courseLevel || course.courseLevel === courseLevel;
    const categoryMatch = !category || course.category === category;
    const topicMatch = !topic || course.topics.includes(topic);
    const skillMatch = !skill || course.skills.includes(skill);

    const searchTarget = `${course.courseNumber} ${course.courseName}`.toLowerCase();
    const searchMatch = !search || searchTarget.includes(search);

    return courseLevelMatch && categoryMatch && topicMatch && skillMatch && searchMatch;
  });
}

function refreshFilterOptions(selected = {}) {
  const courseLevel = normalize(selected.courseLevel);
  const category = normalize(selected.category);
  const topic = normalize(selected.topic);
  const skill = normalize(selected.skill);
  const search = toLower(selected.search);

  const courseLevels = [
    ...new Set(getCoursesMatchingFilters({ category, topic, skill, search }).map((course) => course.courseLevel).filter((level) => level)),
  ].sort();
  const categories = [
    ...new Set(getCoursesMatchingFilters({ courseLevel, topic, skill, search }).map((course) => course.category)),
  ].sort();
  const topics = [
    ...new Set(getCoursesMatchingFilters({ courseLevel, category, skill, search }).flatMap((course) => course.topics)),
  ].sort();
  const skills = [
    ...new Set(getCoursesMatchingFilters({ courseLevel, category, topic, search }).flatMap((course) => course.skills)),
  ].sort();

  populateSelect(refs.courseLevelFilter, courseLevels, "All levels");
  populateSelect(refs.categoryFilter, categories, "All categories");
  populateSelect(refs.topicFilter, topics, "All topics");
  populateSelect(refs.skillFilter, skills, "All skillsets");
}

function buildCategoryColorIndex() {
  state.categoryColorIndex = new Map();

  const categories = new Set([
    ...state.courses.map((course) => course.category),
    ...state.skillToCategory.values(),
    ...state.topicToCategory.values(),
  ]);

  [...categories]
    .filter((category) => normalize(category))
    .sort()
    .forEach((category, index) => {
      const normalizedKey = toLower(category);
      if (!state.categoryColorIndex.has(normalizedKey)) {
        state.categoryColorIndex.set(normalizedKey, index % BADGE_COLOR_CLASSES);
      }
    });
}

function badgeToneClass(category) {
  const normalizedCategory = toLower(category) || "uncategorized";
  if (!state.categoryColorIndex.has(normalizedCategory)) {
    state.categoryColorIndex.set(
      normalizedCategory,
      state.categoryColorIndex.size % BADGE_COLOR_CLASSES,
    );
  }

  return `tone-${state.categoryColorIndex.get(normalizedCategory)}`;
}

function populateSelect(selectElement, options, defaultLabel) {
  const currentValue = selectElement.value;
  selectElement.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  selectElement.appendChild(defaultOption);

  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    selectElement.appendChild(option);
  });

  if (["", ...options].includes(currentValue)) {
    selectElement.value = currentValue;
  }
}

function applyFilters() {
  const courseLevel = normalize(refs.courseLevelFilter.value);
  const category = normalize(refs.categoryFilter.value);
  const topic = normalize(refs.topicFilter.value);
  const skill = normalize(refs.skillFilter.value);
  const search = toLower(refs.searchFilter.value);

  refreshFilterOptions({ courseLevel, category, topic, skill, search });
  state.filteredCourses = getCoursesMatchingFilters({ courseLevel, category, topic, skill, search });

  renderCourseTable();
}

function resetFiltersToDefault() {
  refs.courseLevelFilter.value = "";
  refs.categoryFilter.value = "";
  refs.topicFilter.value = "";
  refs.skillFilter.value = "";
  refs.searchFilter.value = "";
  applyFilters();
}

function resetSelectedPlan() {
  state.selectedCourseIds = new Set();
  state.plannerCredits = {};
  renderCourseTable();
  renderSelectedCourses();
}

function tagList(items, categoryResolver) {
  if (!items.length) return "<span class=\"selected-meta\">None listed</span>";

  const specialGradientKey = "semiconductor fundamentals and device theory";
  const normalizeSpecialKey = (value) =>
    normalize(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/\s+/g, " ")
      .trim();

  return items
    .map((item) => {
      if (normalizeSpecialKey(item) === specialGradientKey) {
        return `<span class="badge" style="background: linear-gradient(90deg, #cffafe 0%, #cffafe 25%, #dcfce7 75%, #dcfce7 100%); border-color: #9acfb7; color: #1f2937;">${escapeHtml(item)}</span>`;
      }
      const category = typeof categoryResolver === "function" ? categoryResolver(item) : "Uncategorized";
      return `<span class=\"badge ${badgeToneClass(category)}\">${escapeHtml(item)}</span>`;
    })
    .join("");
}

function categoryBadge(category) {
  return `<span class=\"badge area-badge ${badgeToneClass(category)}\">${escapeHtml(category)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCourseTable() {
  refs.courseTableBody.innerHTML = "";

  state.filteredCourses.forEach((course) => {
    const row = document.createElement("tr");
    const selected = state.selectedCourseIds.has(course.id);

    row.innerHTML = `
      <td>${escapeHtml(course.courseNumber)}</td>
      <td><div>${escapeHtml(course.courseName)}</div>${catalogButtonMarkup(course.courseNumber)}</td>
      <td>${categoryBadge(course.category)}</td>
      <td class="topics">${tagList(course.topics, (topic) => course.topicCategories?.[topic] || mapLookup(state.topicToCategory, topic) || course.category)}</td>
      <td class="skills">${tagList(course.skills, (skill) => mapLookup(state.skillToCategory, skill) || course.category)}</td>
      <td>${course.credits || ""}</td>
      <td>
        ${selected
          ? `<div style="display: inline-flex; flex-direction: column; gap: 0.35rem;"><button data-course-id="${escapeHtml(course.id)}" disabled>Added</button><button class="secondary" data-remove-course-id="${escapeHtml(course.id)}">Remove</button></div>`
          : `<button data-course-id="${escapeHtml(course.id)}">Add</button>`}
      </td>
    `;

    refs.courseTableBody.appendChild(row);
  });

  refs.resultCount.textContent = `${state.filteredCourses.length} courses shown.`;

  refs.courseTableBody.querySelectorAll("button[data-course-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const courseId = button.getAttribute("data-course-id");
      addCourseToPlan(courseId);
    });
  });

  refs.courseTableBody.querySelectorAll("button[data-remove-course-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const courseId = button.getAttribute("data-remove-course-id");
      removeCourseFromPlan(courseId);
    });
  });
}

function addCourseToPlan(courseId) {
  if (!courseId) return;
  state.selectedCourseIds.add(courseId);
  if (!(courseId in state.plannerCredits)) {
    const course = state.courses.find((item) => item.id === courseId);
    if (course?.hasSpreadsheetCredits) {
      state.plannerCredits[courseId] = Number(course.credits || 0);
    } else {
      state.plannerCredits[courseId] = 0;
    }
  }
  renderCourseTable();
  renderSelectedCourses();
}

function removeCourseFromPlan(courseId) {
  state.selectedCourseIds.delete(courseId);
  delete state.plannerCredits[courseId];
  renderCourseTable();
  renderSelectedCourses();
}

function renderSelectedCourses() {
  refs.selectedCourses.innerHTML = "";

  const selectedCourses = state.courses.filter((course) => state.selectedCourseIds.has(course.id));

  if (!selectedCourses.length) {
    refs.selectedCourses.innerHTML = '<div class="selected-meta">No courses selected.</div>';
  }

  selectedCourses.forEach((course) => {
    const item = document.createElement("div");
    item.className = "selected-item";

    const creditsValue = Number(state.plannerCredits[course.id] || 0);

    const creditsControl = course.hasSpreadsheetCredits
      ? `<div class="credits-fixed">${course.credits}</div>`
      : `<input class="credits-input" type="number" min="0" step="0.5" data-credit-id="${escapeHtml(course.id)}" value="${creditsValue}" />`;

    item.innerHTML = `
      <div>
        <div><strong>${escapeHtml(course.courseNumber)}</strong> - ${escapeHtml(course.courseName)}</div>
        ${catalogButtonMarkup(course.courseNumber)}
        <div class="selected-meta">Certificate area: ${categoryBadge(course.category)}</div>
        <div class="selected-meta">Topics: ${tagList(course.topics, (topic) => course.topicCategories?.[topic] || mapLookup(state.topicToCategory, topic) || course.category)}</div>
        <div class="selected-meta">Skillsets: ${tagList(course.skills, (skill) => mapLookup(state.skillToCategory, skill) || course.category)}</div>
      </div>
      <label>
        Credits
        ${creditsControl}
      </label>
      <button class="secondary" data-remove-id="${escapeHtml(course.id)}">Remove</button>
    `;

    refs.selectedCourses.appendChild(item);
  });

  refs.selectedCourses.querySelectorAll("input[data-credit-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-credit-id");
      state.plannerCredits[id] = parseNumericCredits(input.value);
      updateRequirementStatus();
    });
  });

  refs.selectedCourses.querySelectorAll("button[data-remove-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove-id");
      removeCourseFromPlan(id);
    });
  });

  updateRequirementStatus();
}

function updateRequirementStatus() {
  const selectedCourses = state.courses.filter((course) => state.selectedCourseIds.has(course.id));

  const totalCredits = selectedCourses.reduce((sum, course) => sum + Number(state.plannerCredits[course.id] || 0), 0);
  const categoriesCovered = new Set(selectedCourses.map((course) => course.category)).size;

  refs.creditSummary.textContent = `Credits: ${totalCredits} / 9`;
  refs.categorySummary.textContent = `Categories covered: ${categoriesCovered} / 2`;

  const isMet = totalCredits >= 9 && categoriesCovered >= 2;
  refs.requirementStatus.textContent = isMet
    ? "Requirement met: at least 9 credits across at least 2 categories."
    : "Requirement not yet met.";
  refs.requirementStatus.classList.toggle("success", isMet);
  refs.requirementStatus.classList.toggle("warning", !isMet);
}

function resetAllData() {
  state.courses = [];
  state.filteredCourses = [];
  state.selectedCourseIds = new Set();
  state.plannerCredits = {};
  state.skillToTopic = new Map();
  state.skillToCategory = new Map();
  state.topicToCategory = new Map();
  state.topicIdToName = new Map();
  state.categoryColorIndex = new Map();

  refs.fileInput.value = "";
  refs.searchFilter.value = "";
  refs.courseLevelFilter.innerHTML = "<option value=''>All levels</option>";
  refs.categoryFilter.innerHTML = "<option value=''>All categories</option>";
  refs.topicFilter.innerHTML = "<option value=''>All topics</option>";
  refs.skillFilter.innerHTML = "<option value=''>All skillsets</option>";

  refs.loadStatus.textContent = "No workbook loaded.";
  refs.courseTableBody.innerHTML = "";
  refs.selectedCourses.innerHTML = '<div class="selected-meta">No courses selected.</div>';
  refs.resultCount.textContent = "0 courses shown.";
  updateRequirementStatus();
}

function loadWorkbookFromArrayBuffer(arrayBuffer, sourceLabel) {
  try {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    const overviewSheet = findWorkbookSheet(workbook, OVERVIEW_SHEET_NAME, ["overview"]);
    const topicsSheet = findWorkbookSheet(workbook, TOPICS_SHEET_NAME, ["category & topics", "category and topics", "topics"]);
    const topicIdsSheet = findWorkbookSheet(workbook, TOPIC_IDS_SHEET_NAME, ["topic ids", "topic id", "topic lookup"]);

    if (!overviewSheet || !topicsSheet) {
      throw new Error("Workbook must include both Overview and Category & Topics sheets.");
    }

    const overviewRows = XLSX.utils.sheet_to_json(overviewSheet, { header: 1, raw: false, defval: "" });
    const topicRows = XLSX.utils.sheet_to_json(topicsSheet, { header: 1, raw: false, defval: "" });
    const topicIdRows = topicIdsSheet
      ? XLSX.utils.sheet_to_json(topicIdsSheet, { header: 1, raw: false, defval: "" })
      : [];

    state.topicIdToName = parseTopicIdsSheet(topicIdRows);
    const parsedTopics = parseTopicsSheet(topicRows, state.topicIdToName);
    state.skillToTopic = parsedTopics.skillToTopic;
    state.skillToCategory = parsedTopics.skillToCategory;
    state.topicToCategory = parsedTopics.topicToCategory;
    state.courses = parseOverviewSheet(
      overviewRows,
      state.skillToTopic,
      state.skillToCategory,
      state.topicToCategory,
    );
    state.filteredCourses = [...state.courses];
    state.selectedCourseIds = new Set();
    state.plannerCredits = {};
    buildCategoryColorIndex();

    refreshFilterOptions();
    applyFilters();
    renderSelectedCourses();

    refs.loadStatus.textContent = `Loaded ${state.courses.length} courses from ${sourceLabel}.`;
    refs.loadStatus.classList.remove("warning");
  } catch (error) {
    refs.loadStatus.textContent = `Load error: ${error.message}`;
    refs.loadStatus.classList.add("warning");
  }
}

async function loadWorkbookFromFile(file) {
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  loadWorkbookFromArrayBuffer(arrayBuffer, file.name);
}

async function autoLoadWorkbookFromUrl(url) {
  if (!url) return;

  try {
    refs.loadStatus.textContent = "Loading default workbook...";
    refs.loadStatus.classList.remove("warning");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to fetch default workbook (${response.status}).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    loadWorkbookFromArrayBuffer(arrayBuffer, "default spreadsheet URL");
  } catch (error) {
    refs.loadStatus.textContent = `Default load failed: ${error.message} Upload a workbook manually.`;
    refs.loadStatus.classList.add("warning");
  }
}

refs.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  loadWorkbookFromFile(file);
});

refs.clearDataBtn.addEventListener("click", () => {
  resetAllData();
});

refs.resetFiltersBtn?.addEventListener("click", () => {
  resetFiltersToDefault();
});

refs.resetPlanBtn?.addEventListener("click", () => {
  resetSelectedPlan();
});

[refs.courseLevelFilter, refs.categoryFilter, refs.topicFilter, refs.skillFilter, refs.searchFilter].forEach((input) => {
  input.addEventListener("change", applyFilters);
  if (input === refs.searchFilter) {
    input.addEventListener("input", applyFilters);
  }
});

document.addEventListener("click", handleCatalogInteractions);
document.addEventListener("keydown", handleCatalogEscape);
window.addEventListener("resize", handleCatalogPopoverResize);

resetAllData();
autoLoadWorkbookFromUrl(DEFAULT_WORKBOOK_URL);
