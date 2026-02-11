// src/api/searchService.js
// Napomena: Ostavio sam sve kao u tvom originalu, a u updateSearchPayload sam dodao podršku za:
// - Filter1 (customAttribute_439.id)
// - Filter2 (customAttribute_450.id)
// - Filter3 (customAttribute_477.id)
// - precizno ubacivanje VDB filtera u AND blok koji sadrži uslov isVariant == false
// U komentarima ispod je objašnjeno šta je tačno urađeno.

import payload from './mpPayload.json'
import payloadSingleAsset from './mpSingleAssetPayload.json'

const BASE_URL = process.env.REACT_APP_MGNL_APP_HOST;
console.log("BASE_URL :", BASE_URL);

const apiServiceHandler = async (url, options) => {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error("Something went wrong!");
    }

    const data = await response.json();

    return data;

  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
}

export const getApiBearerToken = () => apiServiceHandler(`${BASE_URL}/rest/sso/auth/jaas/jwt`);

/**
 * ✅ DODATO (PUBLIC AUTH) - UPDATE:
 * Public auth mora da važi samo za MpWidgetsSearch, bez globalnog JAAS login-a.
 * Zato:
 *  - NE KORISTIMO sessionStorage (nema globalnog cache-a)
 *  - SVE "public" requestove radimo sa credentials: "omit" (da ne šaljemo/primamo cookies)
 */

// Preporuka: stavi ove vrednosti kao env var u build-u.
// Ako nisu postavljeni, koristi fallback koji si ti naveo.
const PUBLIC_LOGIN = process.env.REACT_APP_MP_PUBLIC_LOGIN || "WABCO-Guestuser";
const PUBLIC_PASSWORD = process.env.REACT_APP_MP_PUBLIC_PASSWORD || "MediaServices@2017Q3!";

// In-memory cache (nije sessionStorage -> ne “curi” kroz app globalno nakon refresh-a)
let publicTokenCache = null;
let publicTokenExpiresAt = null;

const parseJwtPayload = (jwt) => {
  try {
    if (!jwt || typeof jwt !== "string") return null;
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};

const getJwtExpiresAtMs = (accessToken) => {
  const payload = parseJwtPayload(accessToken);
  if (payload && payload.exp) {
    return payload.exp * 1000;
  }
  return null;
};

export const authUserPublic = async (login, password) => {
  try {
    const body = new URLSearchParams();
    body.append("login", login);
    body.append("password", password);

    const response = await fetch(`${BASE_URL}/rest/sso/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: body.toString(),

      // 🔴 KRITIČNO:
      // Ne šalji i ne prihvataj cookies -> nema globalnog JAAS login-a
      credentials: "omit",

      cache: "no-store"
    });

    if (!response.ok) {
      return { error: `Auth failed (${response.status})`, status: response.status };
    }

    const data = await response.json(); // očekujemo { access_token: "..." }
    return data;

  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
};

export const getPublicApiBearerToken = async () => {
  try {
    // in-memory cache (sa bufferom)
    if (publicTokenCache && publicTokenExpiresAt) {
      const now = Date.now();
      if (now < (publicTokenExpiresAt - 30_000)) {
        return { access_token: publicTokenCache };
      }
    }

    const tokenDto = await authUserPublic(PUBLIC_LOGIN, PUBLIC_PASSWORD);

    if (tokenDto && tokenDto.access_token) {
      publicTokenCache = tokenDto.access_token;
      publicTokenExpiresAt = getJwtExpiresAtMs(tokenDto.access_token) || (Date.now() + 15 * 60 * 1000); // fallback 15min
      return tokenDto;
    }

    return tokenDto; // { error... }

  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
};

const paylodID = (assetId) => {
  // ✅ Duboka kopija da NE mutiramo globalno importovan JSON
  const payloadCopy = JSON.parse(JSON.stringify(payloadSingleAsset));
  payloadCopy.criteria.subs[0].value = '"' + assetId + '"';
  return payloadCopy;
}

export const idSearch = async (assetId) => {

  // MP zna da dolazi i M- prefiks, pa ga skidamo (tvoj postojeći kod)
  assetId = assetId.startsWith("M-") ? assetId.substring(2) : assetId;
  assetId = assetId.startsWith("m-") ? assetId.substring(2) : assetId;

  const token = await getApiBearerToken();

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.1/search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(paylodID(assetId)),
  })

  const data = await response;

  const matchingItem = data.items.find(item => item.fields.id.value.toString() === assetId);

  return matchingItem;
}


export const downloadFileDirect = async (id, selectedOption, download_version, language, licenseId, usePublicAuth = false) => {
  const token = usePublicAuth ? await getPublicApiBearerToken() : await getApiBearerToken();

  if (!token || !token.access_token) {
    return { error: "Missing access token" };
  }

  const requestItem = {
    asset: { id: id },
    download_scheme: { id: selectedOption },
    download_version: download_version,
    language: language
  };

  if (licenseId) {
    requestItem.license_confirmation = {
      license: { id: licenseId }
    };
  }

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.0/assets/downloadLinks/direct`, {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${token.access_token}`,
      'Content-Type': 'application/json'
    },
    credentials: usePublicAuth ? "omit" : "include",
    body: JSON.stringify([requestItem])
  });

  const data = await response;
  return data;
};


const updateCustomSearchPayload = (requestPayload, sortingType, isAsc, offset, limit) => {
  // ✅ pravimo privatnu kopiju kako ne bismo mutirali izvorni objekat koji je možda deljen
  const updatedPayload = JSON.parse(JSON.stringify(requestPayload));

  if (sortingType !== null) {
    const sortingObject = sortingType === 'relevance'
      ? [{ "@type": sortingType, "asc": isAsc }]
      : [{ "@type": "field", "field": sortingType, "asc": isAsc }];
    updatedPayload.output.sorting = sortingObject;
  }

  const pagingObject = { "@type": "offset", "offset": offset, "limit": limit };
  updatedPayload.output.paging = pagingObject;

  return updatedPayload;
}

export const customSearch = async (requestPayload, sortingType, isAsc, offset, limit) => {

  const updatedPayload = updateCustomSearchPayload(requestPayload, sortingType, isAsc, offset, limit);

  const token = await getApiBearerToken();

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.1/search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatedPayload)
  })

  const data = await response;

  return data;
}


/**
 * updateSearchPayload
 * - Prilagođeno da podrži:
 *   • Categories      -> themes.id                    (long_value, any: true)
 *   • File Info       -> extension                    (text_value)
 *   • Keywords        -> structuredKeywords.id        (long_value, any: true)
 *   • VDB             -> vdb.id (u AND bloku sa isVariant == false)
 *   • Filter1         -> customAttribute_439.id       (long_value, any: true)
 *   • Filter2         -> customAttribute_450.id       (long_value, any: true)
 *   • Filter3         -> customAttribute_477.id       (long_value, any: true)
 */
const updateSearchPayload = (
  sortingType,
  isAsc,
  offset,
  limit,
  query,
  selectedCategories,
  selectedSuffixes,
  selectedKeywords,
  selectedVdbs,
  selectedFilter1,
  selectedFilter2,
  selectedFilter3
) => {

  // 1) Sorting + paging
  const sortingObject = sortingType === 'relevance'
    ? [{ "@type": sortingType, "asc": isAsc }]
    : [{ "@type": "field", "field": sortingType, "asc": isAsc }];

  // ✅ Duboka kopija šablona kako bismo izbegli deljenje referenci između instanci
  const updatedPayload = JSON.parse(JSON.stringify(payload));

  updatedPayload.output.sorting = sortingObject;
  const pagingObject = { "@type": "offset", "offset": offset, "limit": limit };
  updatedPayload.output.paging = pagingObject;

  // 2) Upis query vrednosti (zadržavam tvoju logiku sa navodnicima)
  updatedPayload.criteria.subs[0].value = '"' + query + '"';

  // 3) Categories -> themes.id (ugrađuje/menja/uklanja postojeći IN blok)
  const categoriesIndex = updatedPayload.criteria.subs.findIndex(
    sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("themes.id")
  );
  if (selectedCategories && selectedCategories.length > 0) {
    const newObject = {
      "@type": "in",
      "fields": ["themes.id"],
      "long_value": selectedCategories,
      "any": true
    };
    if (categoriesIndex > -1) {
      updatedPayload.criteria.subs[categoriesIndex] = newObject;
    } else {
      updatedPayload.criteria.subs.push(newObject);
    }
  } else if (categoriesIndex > -1) {
    updatedPayload.criteria.subs.splice(categoriesIndex, 1);
  }

  // 4) File Info -> extension
  const fileInfoIndex = updatedPayload.criteria.subs.findIndex(
    sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("extension")
  );
  if (selectedSuffixes && selectedSuffixes.length > 0) {
    const newObject = {
      "@type": "in",
      "fields": ["extension"],
      "text_value": selectedSuffixes,
      "any": true
    };
    if (fileInfoIndex > -1) {
      updatedPayload.criteria.subs[fileInfoIndex] = newObject;
    } else {
      updatedPayload.criteria.subs.push(newObject);
    }
  } else if (fileInfoIndex > -1) {
    updatedPayload.criteria.subs.splice(fileInfoIndex, 1);
  }

  // 5) Keywords -> structuredKeywords.id
  const keywordsIndex = updatedPayload.criteria.subs.findIndex(
    sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("structuredKeywords.id")
  );
  if (selectedKeywords && selectedKeywords.length > 0) {
    const newObject = {
      "@type": "in",
      "fields": ["structuredKeywords.id"],
      "long_value": selectedKeywords,
      "any": true
    };
    if (keywordsIndex > -1) {
      updatedPayload.criteria.subs[keywordsIndex] = newObject;
    } else {
      updatedPayload.criteria.subs.push(newObject);
    }
  } else if (keywordsIndex > -1) {
    updatedPayload.criteria.subs.splice(keywordsIndex, 1);
  }

  // 6) VDB -> vdb.id (u AND bloku sa isVariant == false)
  const andBlockIndex = updatedPayload.criteria.subs.findIndex(
    sub =>
      sub["@type"] === "and" &&
      Array.isArray(sub.subs) &&
      sub.subs.some(x => x["@type"] === "eq" && x.field === "isVariant" && x.value === false)
  );

  if (andBlockIndex > -1) {
    const andBlock = updatedPayload.criteria.subs[andBlockIndex];

    const vdbIndexInAnd = andBlock.subs.findIndex(
      sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("vdb.id")
    );

    if (selectedVdbs && selectedVdbs.length > 0) {
      const vdbObject = {
        "@type": "in",
        "fields": ["vdb.id"],
        "long_value": selectedVdbs,
        "any": true
      };
      if (vdbIndexInAnd > -1) {
        andBlock.subs[vdbIndexInAnd] = vdbObject;
      } else {
        andBlock.subs.push(vdbObject);
      }
    } else if (vdbIndexInAnd > -1) {
      andBlock.subs.splice(vdbIndexInAnd, 1);
    }
  }

  // 7) Filter1 -> customAttribute_439.id
  const f1Index = updatedPayload.criteria.subs.findIndex(
    sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("customAttribute_439.id")
  );
  if (selectedFilter1 && selectedFilter1.length > 0) {
    const newObject = {
      "@type": "in",
      "fields": ["customAttribute_439.id"],
      "long_value": selectedFilter1,
      "any": true
    };
    if (f1Index > -1) {
      updatedPayload.criteria.subs[f1Index] = newObject;
    } else {
      updatedPayload.criteria.subs.push(newObject);
    }
  } else if (f1Index > -1) {
    updatedPayload.criteria.subs.splice(f1Index, 1);
  }

  // 8) Filter2 -> customAttribute_450.id
  const f2Index = updatedPayload.criteria.subs.findIndex(
    sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("customAttribute_450.id")
  );
  if (selectedFilter2 && selectedFilter2.length > 0) {
    const newObject = {
      "@type": "in",
      "fields": ["customAttribute_450.id"],
      "long_value": selectedFilter2,
      "any": true
    };
    if (f2Index > -1) {
      updatedPayload.criteria.subs[f2Index] = newObject;
    } else {
      updatedPayload.criteria.subs.push(newObject);
    }
  } else if (f2Index > -1) {
    updatedPayload.criteria.subs.splice(f2Index, 1);
  }

  // 9) Filter3 -> customAttribute_477.id
  const f3Index = updatedPayload.criteria.subs.findIndex(
    sub => sub["@type"] === "in" && sub.fields && sub.fields.includes("customAttribute_477.id")
  );
  if (selectedFilter3 && selectedFilter3.length > 0) {
    const newObject = {
      "@type": "in",
      "fields": ["customAttribute_477.id"],
      "long_value": selectedFilter3,
      "any": true
    };
    if (f3Index > -1) {
      updatedPayload.criteria.subs[f3Index] = newObject;
    } else {
      updatedPayload.criteria.subs.push(newObject);
    }
  } else if (f3Index > -1) {
    updatedPayload.criteria.subs.splice(f3Index, 1);
  }

  return updatedPayload;
}

export const elasticSearchService = async (
  sortingType,
  isAsc,
  offset,
  limit,
  query,
  selectedCategories,
  selectedSuffixes,
  selectedKeywords,
  selectedVdbs,
  selectedFilter1,
  selectedFilter2,
  selectedFilter3,
  usePublicAuth = false // ✅ ako true -> koristi /rest/sso/auth (cookie-less) + guest creds
) => {

  const updatedPayload = updateSearchPayload(
    sortingType,
    isAsc,
    offset,
    limit,
    query,
    selectedCategories,
    selectedSuffixes,
    selectedKeywords,
    selectedVdbs,
    selectedFilter1,
    selectedFilter2,
    selectedFilter3
  );

  const token = usePublicAuth ? await getPublicApiBearerToken() : await getApiBearerToken();

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.1/search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatedPayload),

    // 🔴 KRITIČNO: kad je public auth, ne šalji/primaj cookies => nema globalnog login-a
    ...(usePublicAuth ? { credentials: "omit" } : {})
  })

  const data = await response;

  return data;
}

export const querySearch = async (
  sortingType,
  isAsc,
  offset,
  limit,
  query,
  selectedCategories,
  selectedSuffixes,
  selectedKeywords,
  selectedVdbs,
  selectedFilter1,
  selectedFilter2,
  selectedFilter3,
  usePublicAuth = false // ✅ isti princip kao elasticSearchService
) => {

  const updatedPayload = updateSearchPayload(
    sortingType,
    isAsc,
    offset,
    limit,
    query,
    selectedCategories,
    selectedSuffixes,
    selectedKeywords,
    selectedVdbs,
    selectedFilter1,
    selectedFilter2,
    selectedFilter3
  );

  const token = usePublicAuth ? await getPublicApiBearerToken() : await getApiBearerToken();

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.1/search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatedPayload),

    // 🔴 KRITIČNO: kad je public auth, ne šalji/primaj cookies => nema globalnog login-a
    ...(usePublicAuth ? { credentials: "omit" } : {})
  })

  const data = await response;

  return data;
}

export const assetVersionsService = async (assetId) => {

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.0/versions/assets/${assetId}`, {
    method: 'GET',
  })

  const assetVersions = await response;

  return assetVersions;
};

export const assetVariantsService = async (assetId) => {

  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.0/assets/masters/${assetId}/variants`, {
    method: 'GET',
  })

  const assetVariants = await response;

  return assetVariants;
};


export const assetRelationsService = async (assetId) => {
  try {
    const relationsArray = await apiServiceHandler(`${BASE_URL}/rest/mp/v1.2/assets/${assetId}/relations`, {
      method: 'GET',
    });

    console.log("relationsArray");
    console.log(relationsArray);

    const relationsArrayUniqueIds = relationsArray.relations
      .map(item => item.relatedAssetId) // izdvajamo samo relatedAssetId
      .reduce((unique, item) => {
        return unique.includes(item) ? unique : [...unique, item];
      }, []); // uklanjamo duplikate

    const payloadArray = relationsArrayUniqueIds.map(assetId => ({ assetId }));

    console.log("payloadArray");
    console.log(payloadArray);

    const token = await getApiBearerToken();

    const response = await apiServiceHandler(`${BASE_URL}/rest/mp/v1.0/assets/load`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ assetVersionIds: payloadArray, expandable: "license, uploadApproval" }),
    });

    const relatedAssets = await response;

    console.log("relatedAssets");
    console.log(relatedAssets);

    return relatedAssets;

  } catch (error) {
    console.error("Asset Relations Service Error" + error);
    return null;
  }
};


// export const getApiBearerToken = () => apiServiceHandler(`${BASE_URL}/rest/sso/auth/jaas/jwt`);
// const token = await getApiBearerToken();
// headers: {
//   "Authorization": `Bearer ${token.access_token}`,
//   "Content-Type": "application/json"
// },
