import { useEffect, useState } from "react";
import SearchBox from "./components/SearchBox";
import PhoneCard from "./components/PhoneCard";
import ComparisonTable from "./components/ComparisonTable";
import LoginPage from "./components/LoginPage";
import { phoneCatalog } from "./data/phoneCatalog";

const MOBILE_API_BASE_URL = "https://api.mobileapi.dev";
const MOBILE_API_KEY = (import.meta.env.VITE_MOBILEAPI_KEY || "").trim();
const API_SOURCES = [
  {
    baseUrl: "https://api-mobilespecs.azharimm.site/v2",
    version: "v2",
  },
  {
    baseUrl: "https://api-mobilespecs.azharimm.dev",
    version: "v1",
  },
];

const DEFAULT_ERROR = "Something went wrong. Please try again later.";
const EMPTY_INPUT_ERROR = "Please enter both mobile names.";
const NOT_FOUND_ERROR = "Mobile not found. Try writing the full model name.";
const API_UNAVAILABLE_ERROR =
  "The public phone API is unavailable right now. The app can still compare phones available in the built-in demo catalog.";
const MOBILE_API_SETUP_ERROR =
  "MobileAPI is not configured. Add VITE_MOBILEAPI_KEY in your Vercel environment variables or local .env file.";
const USERS_STORAGE_KEY = "mobile-comparison-users";
const SESSION_STORAGE_KEY = "mobile-comparison-current-user";
const KNOWN_MANUFACTURERS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Redmi",
  "Poco",
  "Google",
  "OnePlus",
  "Vivo",
  "Oppo",
  "Realme",
  "Motorola",
  "Nothing",
  "Huawei",
  "Honor",
  "Nokia",
  "Sony",
  "Infinix",
  "Tecno",
];

const specMap = {
  releaseDate: {
    sectionKeys: ["launch", "misc"],
    specKeys: ["announced", "status", "launch date", "release date"],
  },
  displaySize: {
    sectionKeys: ["display"],
    specKeys: ["size"],
  },
  displayType: {
    sectionKeys: ["display"],
    specKeys: ["type"],
  },
  processor: {
    sectionKeys: ["platform"],
    specKeys: ["chipset", "cpu"],
  },
  ram: {
    sectionKeys: ["memory"],
    specKeys: ["internal", "ram"],
  },
  storage: {
    sectionKeys: ["memory"],
    specKeys: ["internal", "storage"],
  },
  rearCamera: {
    sectionKeys: ["main camera"],
    specKeys: ["single", "dual", "triple", "quad", "features", "video"],
  },
  frontCamera: {
    sectionKeys: ["selfie camera"],
    specKeys: ["single", "dual", "features", "video"],
  },
  battery: {
    sectionKeys: ["battery"],
    specKeys: ["type"],
  },
  charging: {
    sectionKeys: ["battery"],
    specKeys: ["charging"],
  },
  operatingSystem: {
    sectionKeys: ["platform"],
    specKeys: ["os"],
  },
  network: {
    sectionKeys: ["network"],
    specKeys: ["technology", "2g bands", "3g bands", "4g bands", "5g bands"],
  },
};

const featureRows = [
  { key: "display", label: "Display", formatter: (phone) => joinValues([phone.displaySize, phone.displayType]) },
  { key: "processor", label: "Processor", formatter: (phone) => phone.processor },
  { key: "ram", label: "RAM", formatter: (phone) => phone.ram },
  { key: "storage", label: "Storage", formatter: (phone) => phone.storage },
  { key: "rearCamera", label: "Rear Camera", formatter: (phone) => phone.rearCamera },
  { key: "battery", label: "Battery", formatter: (phone) => phone.battery },
  { key: "operatingSystem", label: "OS", formatter: (phone) => phone.operatingSystem },
];

function normalizeText(value) {
  return (value || "").trim().toLowerCase();
}

function joinValues(values) {
  return values.filter(Boolean).join(" | ");
}

function cleanValue(value) {
  if (Array.isArray(value)) {
    return value.map(cleanValue).filter(Boolean).join(", ");
  }

  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function extractManufacturer(query) {
  const normalizedQuery = normalizeText(query);

  return (
    KNOWN_MANUFACTURERS.find((manufacturer) => {
      const normalizedManufacturer = normalizeText(manufacturer);
      return (
        normalizedQuery.startsWith(`${normalizedManufacturer} `) ||
        normalizedQuery === normalizedManufacturer
      );
    }) || ""
  );
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createBase64Image(imageData) {
  return imageData ? `data:image/jpeg;base64,${imageData}` : "";
}

function getDisplaySizeFromResolution(value) {
  if (!value) {
    return "";
  }

  const match = value.match(/^([^,]+),/);
  return match ? match[1].trim() : "";
}

function extractRamFromHardware(value) {
  if (!value) {
    return "";
  }

  const match = value.match(/(\d+\s*GB\s*RAM)/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function scoreMobileApiMatch(device, query) {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(device?.name || "");
  const normalizedBrand = normalizeText(
    device?.manufacturer_name || device?.brand_name || ""
  );
  const certainty = Number.parseFloat(
    String(device?.match_certainty || "0").replace("%", "")
  );

  let score = Number.isFinite(certainty) ? certainty : 0;

  if (normalizedName === normalizedQuery) {
    score += 200;
  }

  if (`${normalizedBrand} ${normalizedName}` === normalizedQuery) {
    score += 220;
  }

  if (device?.match_type === "exact_model") {
    score += 120;
  }

  if (device?.match_type === "name") {
    score += 40;
  }

  if (normalizedName.includes(normalizedQuery)) {
    score += 70;
  }

  return score;
}

function selectBestMobileApiDevice(devices, query) {
  if (!Array.isArray(devices) || devices.length === 0) {
    return null;
  }

  return [...devices].sort(
    (left, right) => scoreMobileApiMatch(right, query) - scoreMobileApiMatch(left, query)
  )[0];
}

function scoreLocalCatalogMatch(phone, query) {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(phone?.name || "");
  const normalizedBrand = normalizeText(phone?.brand || "");
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  let score = 0;

  if (normalizedName === normalizedQuery) {
    score += 300;
  }

  if (`${normalizedBrand} ${normalizedName}` === normalizedQuery) {
    score += 320;
  }

  if (normalizedName.includes(normalizedQuery)) {
    score += 120;
  }

  if (normalizedQuery.includes(normalizedName)) {
    score += 100;
  }

  const matchedTokens = queryTokens.filter(
    (token) => normalizedName.includes(token) || normalizedBrand.includes(token)
  ).length;

  score += matchedTokens * 18;

  if (
    normalizedQuery.includes("ultra") &&
    !normalizedName.includes("ultra")
  ) {
    score -= 140;
  }

  if (
    normalizedQuery.includes("pro") &&
    !normalizedName.includes("pro")
  ) {
    score -= 120;
  }

  if (
    normalizedQuery.includes("plus") &&
    !normalizedName.includes("plus")
  ) {
    score -= 120;
  }

  if (
    normalizedQuery.includes("note") &&
    !normalizedName.includes("note")
  ) {
    score -= 120;
  }

  return score;
}

function selectBestLocalCatalogDevice(devices, query) {
  if (!Array.isArray(devices) || devices.length === 0) {
    return null;
  }

  const rankedMatches = devices
    .map((device) => ({
      device,
      score: scoreLocalCatalogMatch(device, query),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = rankedMatches[0];

  if (!bestMatch) {
    return null;
  }

  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(bestMatch.device.name);
  const exactLikeMatch =
    normalizedName === normalizedQuery ||
    normalizedName.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedName);

  if (bestMatch.score < 110 && !exactLikeMatch) {
    return null;
  }

  return bestMatch.device;
}

function getStoredUsers() {
  const rawUsers = window.localStorage.getItem(USERS_STORAGE_KEY);

  if (!rawUsers) {
    return [];
  }

  try {
    const parsedUsers = JSON.parse(rawUsers);
    return Array.isArray(parsedUsers) ? parsedUsers : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users) {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function pickSection(sections, sectionKeys) {
  return sections.find((section) =>
    sectionKeys.includes(normalizeText(section?.title))
  );
}

function findSpecValue(section, specKeys) {
  if (!section?.specs) {
    return "";
  }

  const normalizedKeys = specKeys.map(normalizeText);

  const directMatch = section.specs.find((item) =>
    normalizedKeys.includes(normalizeText(item?.key))
  );

  if (directMatch) {
    return cleanValue(directMatch.val);
  }

  return "";
}

function extractSpec(sections, config) {
  const section = pickSection(sections, config.sectionKeys);

  if (!section) {
    return "";
  }

  if (config.specKeys.length === 1) {
    return findSpecValue(section, config.specKeys);
  }

  const values = config.specKeys
    .map((key) => findSpecValue(section, [key]))
    .filter(Boolean);

  return values.join(" | ");
}

function selectBestMatch(results, query) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const normalizedQuery = normalizeText(query);

  const scoredResults = results.map((phone, index) => {
    const name = normalizeText(phone?.phone_name || phone?.name);
    const slug = normalizeText(phone?.slug || "");
    let score = 0;

    if (name === normalizedQuery) {
      score += 200;
    }

    if (name.includes(normalizedQuery)) {
      score += 120;
    }

    if (normalizedQuery.includes(name)) {
      score += 90;
    }

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const matchedTokens = queryTokens.filter(
      (token) => name.includes(token) || slug.includes(token)
    ).length;

    score += matchedTokens * 12;
    score -= index;

    return { phone, score };
  });

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults[0]?.phone ?? null;
}

function extractSlug(result) {
  return result?.slug || result?.detail?.split("/").filter(Boolean).pop() || "";
}

function buildDetailUrl(result, source) {
  if (result?.detail) {
    return result.detail.startsWith("http")
      ? result.detail
      : `${source.baseUrl}${result.detail}`;
  }

  const slug = extractSlug(result);
  return slug ? `${source.baseUrl}/${slug}` : "";
}

function normalizePhoneData(detail, fallbackResult) {
  const sections = detail?.specifications || detail?.data?.specifications || [];
  const image =
    detail?.thumbnail ||
    detail?.phone_images?.[0] ||
    fallbackResult?.image ||
    "";

  const phone = {
    name:
      detail?.phone_name ||
      detail?.title ||
      fallbackResult?.phone_name ||
      "Unknown phone",
    brand: detail?.brand || fallbackResult?.brand || "Not available",
    image,
    releaseDate: extractSpec(sections, specMap.releaseDate) || "Not available",
    displaySize: extractSpec(sections, specMap.displaySize) || "Not available",
    displayType: extractSpec(sections, specMap.displayType) || "Not available",
    processor: extractSpec(sections, specMap.processor) || "Not available",
    ram: extractSpec(sections, specMap.ram) || "Not available",
    storage: extractSpec(sections, specMap.storage) || "Not available",
    rearCamera: extractSpec(sections, specMap.rearCamera) || "Not available",
    frontCamera: extractSpec(sections, specMap.frontCamera) || "Not available",
    battery: extractSpec(sections, specMap.battery) || "Not available",
    charging: extractSpec(sections, specMap.charging) || "Not available",
    operatingSystem:
      extractSpec(sections, specMap.operatingSystem) || "Not available",
    network: extractSpec(sections, specMap.network) || "Not available",
  };

  return phone;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const text = await response.text();
  return parseJsonSafely(text);
}

async function fetchMobileApiJson(path, params = {}, allowNotFound = false) {
  if (!MOBILE_API_KEY) {
    throw new Error("MOBILE_API_KEY_MISSING");
  }

  const url = new URL(`${MOBILE_API_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("key", MOBILE_API_KEY);

  const response = await fetch(url.toString());

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`MOBILE_API_${response.status}`);
  }

  const text = await response.text();
  return parseJsonSafely(text);
}

async function fetchMobileApiPhone(query) {
  const manufacturer = extractManufacturer(query);
  let searchResponse = await fetchMobileApiJson("/devices/search/", {
    name: query,
    exact: true,
    manufacturer,
    page: 1,
  });

  let devices = searchResponse?.devices || [];

  if (devices.length === 0) {
    searchResponse = await fetchMobileApiJson("/devices/search/", {
      name: query,
      manufacturer,
      page: 1,
    });

    devices = searchResponse?.devices || [];
  }

  const selectedDevice = selectBestMobileApiDevice(devices, query);

  if (!selectedDevice) {
    throw new Error("NOT_FOUND");
  }

  const [
    displayData,
    platformData,
    memoryData,
    mainCameraData,
    selfieCameraData,
    batteryData,
    networkData,
  ] = await Promise.all([
    fetchMobileApiJson(`/devices/${selectedDevice.id}/display/`, {}, true),
    fetchMobileApiJson(`/devices/${selectedDevice.id}/platform/`, {}, true),
    fetchMobileApiJson(`/devices/${selectedDevice.id}/memory/`, {}, true),
    fetchMobileApiJson(`/devices/${selectedDevice.id}/main-camera/`, {}, true),
    fetchMobileApiJson(`/devices/${selectedDevice.id}/selfie-camera/`, {}, true),
    fetchMobileApiJson(`/devices/${selectedDevice.id}/battery/`, {}, true),
    fetchMobileApiJson(`/devices/${selectedDevice.id}/network/`, {}, true),
  ]);

  return {
    name: selectedDevice.name || query,
    brand:
      selectedDevice.manufacturer_name ||
      selectedDevice.brand_name ||
      manufacturer ||
      "Not available",
    image: createBase64Image(selectedDevice.image_b64),
    releaseDate: selectedDevice.release_date || "Not available",
    displaySize:
      displayData?.size ||
      getDisplaySizeFromResolution(selectedDevice.screen_resolution) ||
      "Not available",
    displayType:
      joinValues([displayData?.type, displayData?.resolution]) ||
      selectedDevice.screen_resolution ||
      "Not available",
    processor:
      joinValues([platformData?.chipset, platformData?.cpu]) ||
      selectedDevice.hardware ||
      "Not available",
    ram:
      memoryData?.internal ||
      extractRamFromHardware(selectedDevice.hardware) ||
      "Not available",
    storage:
      memoryData?.internal || selectedDevice.storage || "Not available",
    rearCamera:
      joinValues([
        mainCameraData?.modules,
        mainCameraData?.features,
        mainCameraData?.video,
      ]) ||
      selectedDevice.camera ||
      "Not available",
    frontCamera:
      joinValues([
        selfieCameraData?.modules,
        selfieCameraData?.features,
        selfieCameraData?.video,
      ]) || "Not available",
    battery:
      batteryData?.type ||
      selectedDevice.battery_capacity ||
      "Not available",
    charging: batteryData?.charging || "Not available",
    operatingSystem: platformData?.os || "Not available",
    network: networkData?.technology || "Not available",
  };
}

async function searchPhoneWithSource(query, source) {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `${source.baseUrl}/search?query=${encodedQuery}`;
  const searchData = await fetchJson(searchUrl);

  const results =
    searchData?.data ||
    searchData?.phones ||
    searchData?.results ||
    [];

  const bestMatch = selectBestMatch(results, query);

  if (!bestMatch) {
    throw new Error("NOT_FOUND");
  }

  const detailUrl = buildDetailUrl(bestMatch, source);

  if (!detailUrl) {
    throw new Error("NOT_FOUND");
  }

  const detailData = await fetchJson(detailUrl);
  return normalizePhoneData(detailData?.data || detailData, bestMatch);
}

async function searchPhone(query) {
  let lastError = null;
  let sawNetworkFailure = false;

  try {
    return await fetchMobileApiPhone(query);
  } catch (error) {
    lastError = error;

    if (
      error.message !== "NOT_FOUND" &&
      error.message !== "MOBILE_API_KEY_MISSING"
    ) {
      sawNetworkFailure = true;
    }
  }

  for (const source of API_SOURCES) {
    try {
      return await searchPhoneWithSource(query, source);
    } catch (error) {
      lastError = error;

      if (error.message !== "NOT_FOUND") {
        sawNetworkFailure = true;
      }
    }
  }

  const localMatch = selectBestLocalCatalogDevice(phoneCatalog, query);

  if (localMatch) {
    return localMatch;
  }

  if (lastError?.message === "NOT_FOUND") {
    throw lastError;
  }

  if (sawNetworkFailure) {
    throw new Error("API_UNAVAILABLE");
  }

  if (lastError?.message === "MOBILE_API_KEY_MISSING") {
    throw new Error("MOBILE_API_KEY_MISSING");
  }

  throw lastError || new Error(DEFAULT_ERROR);
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loginError, setLoginError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const [leftPhone, setLeftPhone] = useState(null);
  const [rightPhone, setRightPhone] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  useEffect(() => {
    const savedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!savedSession) {
      return;
    }

    try {
      const parsedSession = JSON.parse(savedSession);
      setCurrentUser(parsedSession);
      setIsAuthenticated(true);
    } catch {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const updateAuthField = (field, value) => {
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const resetAuthForm = () => {
    setAuthForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const handleAuthModeChange = (mode) => {
    setAuthMode(mode);
    setLoginError("");
    setAuthSuccess("");
    resetAuthForm();
  };

  const handleLogin = (event) => {
    event.preventDefault();

    const email = normalizeEmail(authForm.email);
    const password = authForm.password.trim();

    setLoginError("");
    setAuthSuccess("");

    if (authMode === "register") {
      const name = authForm.name.trim();
      const confirmPassword = authForm.confirmPassword.trim();

      if (!name || !email || !password || !confirmPassword) {
        setLoginError("Please fill in all registration fields.");
        return;
      }

      if (!email.includes("@")) {
        setLoginError("Please enter a valid email address.");
        return;
      }

      if (password.length < 4) {
        setLoginError("Password must be at least 4 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setLoginError("Passwords do not match.");
        return;
      }

      const storedUsers = getStoredUsers();
      const existingUser = storedUsers.find(
        (user) => normalizeEmail(user.email) === email
      );

      if (existingUser) {
        setLoginError("An account with this email already exists.");
        return;
      }

      const newUser = {
        id: Date.now(),
        name,
        email,
        password,
      };

      saveStoredUsers([...storedUsers, newUser]);
      setAuthSuccess("Registration successful. Please log in with your account.");
      setAuthMode("login");
      setAuthForm({
        name: "",
        email,
        password: "",
        confirmPassword: "",
      });
      return;
    }

    if (!email || !password) {
      setLoginError("Please enter your email and password.");
      return;
    }

    const storedUsers = getStoredUsers();
    const matchedUser = storedUsers.find(
      (user) =>
        normalizeEmail(user.email) === email && user.password === password
    );

    if (!matchedUser) {
      setLoginError("Invalid email or password.");
      return;
    }

    const sessionUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
    };

    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(sessionUser)
    );
    setCurrentUser(sessionUser);
    setIsAuthenticated(true);
    setLoginError("");
    setAuthSuccess("");
    resetAuthForm();
  };

  const handleLogout = () => {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLeftPhone(null);
    setRightPhone(null);
    setLeftQuery("");
    setRightQuery("");
    setHasCompared(false);
    setErrorMessage("");
    handleAuthModeChange("login");
  };

  const handleCompare = async () => {
    const firstPhone = leftQuery.trim();
    const secondPhone = rightQuery.trim();

    setErrorMessage("");
    setHasCompared(false);

    if (!firstPhone || !secondPhone) {
      setLeftPhone(null);
      setRightPhone(null);
      setErrorMessage(EMPTY_INPUT_ERROR);
      return;
    }

    setIsLoading(true);

    try {
      const [leftResult, rightResult] = await Promise.all([
        searchPhone(firstPhone),
        searchPhone(secondPhone),
      ]);

      setLeftPhone(leftResult);
      setRightPhone(rightResult);
      setHasCompared(true);
    } catch (error) {
      setLeftPhone(null);
      setRightPhone(null);
      setHasCompared(false);
      setErrorMessage(
        error.message === "NOT_FOUND"
          ? NOT_FOUND_ERROR
          : error.message === "MOBILE_API_KEY_MISSING"
            ? MOBILE_API_SETUP_ERROR
          : error.message === "API_UNAVAILABLE"
            ? API_UNAVAILABLE_ERROR
            : DEFAULT_ERROR
      );
    } finally {
      setIsLoading(false);
    }
  };

  const comparisonRows =
    leftPhone && rightPhone
      ? featureRows.map((row) => ({
          feature: row.label,
          leftValue: row.formatter(leftPhone) || "Not available",
          rightValue: row.formatter(rightPhone) || "Not available",
        }))
      : [];

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <div className="background-orb background-orb-left" />
        <div className="background-orb background-orb-right" />
        <LoginPage
          authMode={authMode}
          formData={authForm}
          onFieldChange={updateAuthField}
          onSubmit={handleLogin}
          onModeChange={handleAuthModeChange}
          errorMessage={loginError}
          successMessage={authSuccess}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <main className="page">
        <section className="app-topbar">
          <div className="session-chip">
            Signed in as {currentUser?.name || currentUser?.email}
          </div>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </section>

        <section className="hero">
          <p className="hero-badge">University Project Friendly</p>
          <h1>Mobile Comparison Web App</h1>
          <p className="hero-text">
            Compare two mobile phones side by side by entering the company and
            model name, then reviewing their most important specifications in a
            clean, simple layout.
          </p>
        </section>

        <section className="search-panel">
          <div className="search-grid">
            <SearchBox
              label="Left Mobile"
              placeholder="Samsung Galaxy S23"
              value={leftQuery}
              onChange={setLeftQuery}
            />
            <SearchBox
              label="Right Mobile"
              placeholder="iPhone 14"
              value={rightQuery}
              onChange={setRightQuery}
            />
          </div>

          <button className="compare-button" onClick={handleCompare}>
            Compare Mobiles
          </button>

          {isLoading && <p className="status-message">Loading mobile data...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </section>

        <section className="results-grid">
          <PhoneCard title="Left Mobile" phone={leftPhone} />
          <PhoneCard title="Right Mobile" phone={rightPhone} />
        </section>

        {hasCompared && leftPhone && rightPhone && (
          <ComparisonTable
            leftPhoneName={leftPhone.name}
            rightPhoneName={rightPhone.name}
            rows={comparisonRows}
          />
        )}
      </main>
    </div>
  );
}
