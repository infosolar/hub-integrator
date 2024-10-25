import axios from 'axios';
import type { IFetchDataResponse, IDealApiNotEditable } from "@/types/interfaces/api"
import type { IDealDataEditable, IDealDataNotEditable } from "@/types/interfaces/deals"

const apiUrl = window?.__ENV__?.VITE_API_URL;

// Get deal data
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_DEAL_DATA') {
    if (isDribbbleMessagePage()) {
      const dealURL: string = window.location.href;

      if (dealURL) {
        fetchDealFromAPI(dealURL)
          .then((data) => {
            if (data && typeof data === 'object') {
              const dealData: IDealDataNotEditable = {
                dealName: data.dealname,
                amount: data.amount,
                leadChannel: data.lead_channel,
                requestType: data.request_type,
                description: data.description,
                modelOfWorkType: data.model_of_work_type,
                hsAnalyticsSource: data.hs_analytics_source,
                communicationChannel: data.communication_channel,
                salesType: data.sales_type,
                serviceType: data.service_type,
                clientsLanguage: data.client_s_language,
                contacts: data.contacts.map(i => {
                  return {
                    firstName: i.firstname,
                    lastName: i.lastname,
                    email: i.email,
                    phone: i.phone,
                    gender: i.gender,
                    mobilePhone: i.mobilephone,
                    workEmail: i.work_email,
                    country: i.country,
                    city: i.city,
                    industry: i.industry,
                    jobTitle: i.jobtitle,
                    hsLeadStatus: i.hs_lead_status,
                  }
                }),
                dealStage: data.dealstage,
              }

              sendResponse({
                success: true,
                editable: false,
                data: dealData
              });
            } else { // get from html
              sendResponse({
                success: true,
                editable: true,
                data: getDealInfoFromDribbleHtml()
              });
            }
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message
            });
          });

        return true;
      }
    } else {
      sendResponse({
        success: false,
        data: {}
      });
    }
  }
});

function isDribbbleMessagePage() {
  const currentUrl = window.location.href;
  const messagePageRegex = /dribbble\.com\/messages\/\d+/;
  return messagePageRegex.test(currentUrl);
}

const fetchDealFromAPI = async (dealURL: string): Promise<IDealApiNotEditable | boolean> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['authToken'], async (result) => {
      if (result.authToken) {
        try {
          const response: IFetchDataResponse = await axios.get(`${apiUrl}/deal?url=${dealURL}`, {
            headers: {
              Authorization: `Bearer ${result.authToken}`,
            },
          });

          if (response.status === 200) {
            resolve(response.data);
          } else {
            reject(new Error('Error while fetching from the API'));
          }

        } catch (error) {
          resolve(false);
        }

      } else {
        resolve(false);
      }
    });
  });
};

function getDealInfoFromDribbleHtml(): IDealDataEditable {
  const dealUrl = window.location.href;
  const dealID = getIdFromUrl(dealUrl);
  const nameEl = document.querySelector('.sender-info-box__name');
  const locationEl = document.querySelector('.sender-info-box__location');
  const mainMessageEl: HTMLElement | null = document.querySelector('.project-request-widget__inner');
  let textContent = '';

  if (mainMessageEl) {
    textContent = mainMessageEl.textContent || mainMessageEl.innerText;
    textContent = textContent
      .replace(/\n\s*\n/g, '\n') // Remove extra empty lines
      .replace(/^\s+/gm, ''); // Remove spaces at the beginning of a line
  }

  return {
    dealID,
    dealName: `[#${dealID}] ${nameEl?.textContent?.trim()} - NEW Deal`,
    amount: 0,
    leadChannel: 'Dribble',
    requestType: 'Inbound',
    description: textContent,
    modelOfWorkType: [],
    hsAnalyticsSource: [],
    communicationChannel: [],
    salesType: [],
    serviceType: [],
    clientsLanguage: [],
    firstName: nameEl?.textContent?.trim(),
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    mobilePhone: '',
    workEmail : '',
    country: '',
    city: locationEl?.textContent?.trim() || '',
    industry: '',
    jobTitle: '',
    hsLeadStatus: [],
    websiteUrlRequestSentFrom: dealUrl,
    dealStage: '',
  }
}

function getIdFromUrl(url: string): string {
  const regex = /dribbble\.com\/messages\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
}


self.onerror = function (message, source, lineno, colno, error) {
  console.info(
    `Error: ${message}\nSource: ${source}\nLine: ${lineno}\nColumn: ${colno}\nError object: ${error}`
  )
}
