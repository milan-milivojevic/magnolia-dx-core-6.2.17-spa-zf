import payload from './mpPayload.json';
import payloadSingleAsset from './mpSingleAssetPayload.json';

const BASE_URL = process.env.REACT_APP_MGNL_APP_HOST;

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

const PUBLIC_LOGIN = process.env.REACT_APP_MP_PUBLIC_LOGIN || "WABCO-Guestuser";
const PUBLIC_PASSWORD = process.env.REACT_APP_MP_PUBLIC_PASSWORD || "MediaServices@2017Q3!";

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

      credentials: "omit",

      cache: "no-store"
    });

    if (!response.ok) {
      return { error: `Auth failed (${response.status})`, status: response.status };
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
};

export const getPublicApiBearerToken = async () => {
  try {
    if (publicTokenCache && publicTokenExpiresAt) {
      const now = Date.now();
      if (now < (publicTokenExpiresAt - 30_000)) {
        return { access_token: publicTokenCache };
      }
    }

    const tokenDto = await authUserPublic(PUBLIC_LOGIN, PUBLIC_PASSWORD);

    if (tokenDto && tokenDto.access_token) {
      publicTokenCache = tokenDto.access_token;
      publicTokenExpiresAt = getJwtExpiresAtMs(tokenDto.access_token) || (Date.now() + 15 * 60 * 1000);
      return tokenDto;
    }

    return tokenDto;

  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
};

const paylodID = (assetId) => {
  const payloadCopy = JSON.parse(JSON.stringify(payloadSingleAsset));
  payloadCopy.criteria.subs[0].value = '"' + assetId + '"';
  return payloadCopy;
};

export const idSearch = async (assetId) => {
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
  });

  const data = await response;

  const matchingItem = data.items.find(item => item.fields.id.value.toString() === assetId);

  return matchingItem;
};


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
  });

  const data = await response;

  return data;
};
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
  const sortingObject = sortingType === 'relevance'
    ? [{ "@type": sortingType, "asc": isAsc }]
    : [{ "@type": "field", "field": sortingType, "asc": isAsc }];

  const updatedPayload = JSON.parse(JSON.stringify(payload));

  updatedPayload.output.sorting = sortingObject;
  const pagingObject = { "@type": "offset", "offset": offset, "limit": limit };
  updatedPayload.output.paging = pagingObject;

  updatedPayload.criteria.subs[0].value = '"' + query + '"';

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
};

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
  usePublicAuth = false
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
    ...(usePublicAuth ? { credentials: "omit" } : {})
  });

  const data = await response;

  return data;
};

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
  usePublicAuth = false
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
    ...(usePublicAuth ? { credentials: "omit" } : {})
  });

  const data = await response;

  return data;
};

export const assetVersionsService = async (assetId) => {
  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.0/versions/assets/${assetId}`, {
    method: 'GET',
  });

  const assetVersions = await response;

  return assetVersions;
};

export const assetVariantsService = async (assetId) => {
  const response = apiServiceHandler(`${BASE_URL}/rest/mp/v1.0/assets/masters/${assetId}/variants`, {
    method: 'GET',
  });

  const assetVariants = await response;

  return assetVariants;
};

export const assetRelationsService = async (assetId) => {
  try {
    const relationsArray = await apiServiceHandler(`${BASE_URL}/rest/mp/v1.2/assets/${assetId}/relations`, {
      method: 'GET',
    });

    const relationsArrayUniqueIds = relationsArray.relations
      .map(item => item.relatedAssetId)
      .reduce((unique, item) => {
        return unique.includes(item) ? unique : [...unique, item];
      }, []);

    const payloadArray = relationsArrayUniqueIds.map(assetId => ({ assetId }));

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

    return relatedAssets;
  } catch (error) {
    console.error("Asset Relations Service Error" + error);
    return null;
  }
};
