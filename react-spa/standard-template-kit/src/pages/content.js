import React, { useState, useEffect } from 'react';
import { EditableArea } from '@magnolia/react-editor';
import '../css.css';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { getRouterBasename } from '../helpers/AppHelpers';
import { aclCheck } from '../helpers/ACL';

const PUBLIC_LOGIN = process.env.REACT_APP_MP_PUBLIC_LOGIN || "WABCO-Guestuser";
const PUBLIC_PASSWORD = process.env.REACT_APP_MP_PUBLIC_PASSWORD || "MediaServices@2017Q3!";
const PUBLIC_AUTH_STORAGE_KEY_CONTENT = "mp_public_access_token_content";

let publicUserGroupsCache = null;
let publicUserGroupsPromise = null;

const getPublicAccessTokenContent = async (baseUrl) => {
  try {
    const cachedRaw = sessionStorage.getItem(PUBLIC_AUTH_STORAGE_KEY_CONTENT);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.access_token && cached.createdAt && (Date.now() - cached.createdAt) < (30 * 60 * 1000)) {
        return cached.access_token;
      }
    }

    const body = new URLSearchParams();
    body.append("login", PUBLIC_LOGIN);
    body.append("password", PUBLIC_PASSWORD);

    const resp = await fetch(`${baseUrl}/rest/sso/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: body.toString(),
      credentials: "omit"
    });

    if (!resp.ok) {
      return null;
    }

    const tokenDto = await resp.json();
    if (tokenDto && tokenDto.access_token) {
      sessionStorage.setItem(PUBLIC_AUTH_STORAGE_KEY_CONTENT, JSON.stringify({ access_token: tokenDto.access_token, createdAt: Date.now() }));
      return tokenDto.access_token;
    }

    return null;

  } catch (e) {
    return null;
  }
};

const getPublicUserGroups = async (baseUrl) => {
  try {
    if (publicUserGroupsCache) {
      return publicUserGroupsCache;
    }

    if (publicUserGroupsPromise) {
      return publicUserGroupsPromise;
    }

    publicUserGroupsPromise = (async () => {
      const accessToken = await getPublicAccessTokenContent(baseUrl);

      if (!accessToken) {
        publicUserGroupsCache = [];
        return publicUserGroupsCache;
      }

      const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      };

      const [orgUnitResp, vdbGroupResp] = await Promise.all([
        fetch(`${baseUrl}/rest/administration/users/current`, { headers, credentials: "omit", cache: "no-store" }),
        fetch(`${baseUrl}/rest/sso/users/current`, { headers, credentials: "omit", cache: "no-store" })
      ]);

      const orgUnit = orgUnitResp.ok ? await orgUnitResp.json() : null;
      const vdbGroup = vdbGroupResp.ok ? await vdbGroupResp.json() : null;

      const groups = [];

      if (orgUnit && orgUnit.orgUnitName) {
        groups.push("/BM_" + orgUnit.orgUnitName);
      }

      if (vdbGroup && vdbGroup.vdbGroupName) {
        groups.push("/VDBG_" + vdbGroup.vdbGroupName);
      }

      publicUserGroupsCache = groups;
      return publicUserGroupsCache;
    })();

    const result = await publicUserGroupsPromise;
    publicUserGroupsPromise = null;
    return result;

  } catch (e) {
    publicUserGroupsPromise = null;
    publicUserGroupsCache = [];
    return publicUserGroupsCache;
  }
};

const publicAclCheck = async (baseUrl, allowedGroups, deniedGroups, hideComponent) => {
  try {
    if (hideComponent === true || hideComponent === "true") {
      return false;
    }

    if (allowedGroups.length === 0 && deniedGroups.length === 0) {
      return true;
    }

    const userGroups = await getPublicUserGroups(baseUrl);

    if (!userGroups || userGroups.length === 0) {
      return false;
    }

    const hasAllowedGroup = allowedGroups.some(group => userGroups.includes(group));
    const hasDeniedGroup = deniedGroups.some(group => userGroups.includes(group));

    if (hasDeniedGroup) {
      return false;
    }

    if (allowedGroups.length > 0) {
      return hasAllowedGroup;
    }

    return true;

  } catch (e) {
    return false;
  }
};

function ContentPage ({
  title, 
  bannerSection, 
  mainSection,

  allowedGroups = [],
  deniedGroups = [],
  hideComponent = false }) {
  
  const [aclValue, setAclValue] = useState(null);
  const basicAclCheck = allowedGroups.length === 0 && deniedGroups.length === 0 && (hideComponent === false || hideComponent === "false");

  const isPagesApp = window.location.search.includes("mgnlPreview");
  const editMode = isPagesApp ? true : false;
  const baseUrl = process.env.REACT_APP_MGNL_APP_HOST;

  const [isUserLogged, setIsUserLogged] = useState(false);
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  useEffect(() => {
    if (basicAclCheck === true || editMode === true) {
      setIsUserLogged(false);
      setIsUserLoaded(true);
      return;
    }

    fetch(`${baseUrl}/rest/administration/users/_current`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setIsUserLogged(!!data?.login);
        setIsUserLoaded(true);
      })
      .catch(error => {
        setIsUserLogged(false);
        setIsUserLoaded(true);
      });
  }, [basicAclCheck, editMode, baseUrl]);

  useEffect(() => {
    if (editMode === true) {
      setAclValue(true);
      return;
    }

    if (basicAclCheck === true) {
      setAclValue(true);
      return;
    }

    if (!isUserLoaded) {
      return;
    }

    if (!isUserLogged) {
      publicAclCheck(baseUrl, allowedGroups, deniedGroups, hideComponent)
        .then((response) => {
          setAclValue(response);
        })
        .catch((error) => {
          console.error("Greška prilikom izvršavanja publicAclCheck:", error);
          setAclValue(false);
        });
      return;
    }

    aclCheck(allowedGroups, deniedGroups, hideComponent)
      .then((response) => {
        setAclValue(response); 
      })
      .catch((error) => {
        console.error("Greška prilikom izvršavanja aclCheck:", error);
        setAclValue(false);
      });
  }, [basicAclCheck, allowedGroups, deniedGroups, hideComponent, isUserLogged, isUserLoaded, editMode, baseUrl]);

  setTimeout(() => {
    const loaderElement = document.querySelector(".loader-container");
    if (loaderElement) {
      loaderElement.remove();
    }
  }, 2000);

  return (
    <HelmetProvider>
      <Helmet>
          <title>{title}</title>
      </Helmet>
      { !editMode &&
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      }
      { editMode === false && aclValue === false && basicAclCheck === false &&
        <div className="no-access-page">
          <p>You do not have sufficient rights to view this page.</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = `${baseUrl}${getRouterBasename()}`;
            }}
          >
            Go to Home
          </button>
        </div>   
      }
      { (aclValue === true || editMode === true) &&
        <div className='contentPage'>
          <div className='bannerSection'>{bannerSection && <EditableArea content={bannerSection} />}</div>
          <div>{mainSection && <EditableArea content={mainSection} />}</div>
        </div>    
      }
    </HelmetProvider>
  );
}

export default ContentPage;
