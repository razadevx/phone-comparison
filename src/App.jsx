import { useEffect, useState } from "react";
import SearchBox from "./components/SearchBox";
import PhoneCard from "./components/PhoneCard";
import ComparisonTable from "./components/ComparisonTable";
import LoginPage from "./components/LoginPage";
import { phoneCatalog } from "./data/phoneCatalog";

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
const LOGIN_PASSWORD = "1234";
const LOGIN_ERROR = "Incorrect password. Please try again.";
const LOGIN_STORAGE_KEY = "mobile-comparison-auth";

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

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
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

  const localMatch = selectBestMatch(phoneCatalog, query);

  if (localMatch) {
    return localMatch;
  }

  if (lastError?.message === "NOT_FOUND") {
    throw lastError;
  }

  if (sawNetworkFailure) {
    throw new Error("API_UNAVAILABLE");
  }

  throw lastError || new Error(DEFAULT_ERROR);
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const [leftPhone, setLeftPhone] = useState(null);
  const [rightPhone, setRightPhone] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  useEffect(() => {
    const savedLogin = window.sessionStorage.getItem(LOGIN_STORAGE_KEY);
    setIsAuthenticated(savedLogin === "true");
  }, []);

  const handleLogin = (event) => {
    event.preventDefault();

    if (loginPassword === LOGIN_PASSWORD) {
      window.sessionStorage.setItem(LOGIN_STORAGE_KEY, "true");
      setIsAuthenticated(true);
      setLoginError("");
      setLoginPassword("");
      return;
    }

    setLoginError(LOGIN_ERROR);
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
          password={loginPassword}
          onPasswordChange={setLoginPassword}
          onSubmit={handleLogin}
          errorMessage={loginError}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <main className="page">
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
