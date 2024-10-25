<script setup lang="ts">
import axios from 'axios';
import type { IDealDataEditable, IDealDataNotEditable } from "@/types/interfaces/deals"
import { IDealApiNotEditable, IDealApiEditable } from "@/types/interfaces/api"

const store = useAppStore()

const apiUrl = import.meta.env.VITE_API_URL;

const isLoggedIn = computed(() => store.isLoggedIn)
const isLoading = computed(() => store.loading)

const isDealPage = ref<boolean>(false);

// step 1. get deal from "chrome.storage.local"
// step 2. if there is no deal data, we send a request to the content script
// step 3. content script is listening the "GET_DEAL_DATA" event and fetch data from api
// step 4. if there is no data, we will get data from the page layout
// step 5. background script needs for remove deal data from the "chrome.storage.local" if page url changed
const dealDataNotEditable = ref<IDealDataNotEditable | null>(null);
const dealDataEditable = reactive<IDealDataEditable>({
  dealID: '',
  dealName: '',
  amount: 0,
  leadChannel: '',
  requestType: '',
  description: '',
  modelOfWorkType: [],
  hsAnalyticsSource: [],
  communicationChannel: [],
  salesType: [],
  serviceType: [],
  clientsLanguage: [],
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: '',
  mobilePhone: '',
  workEmail : '',
  country: '',
  city: '',
  industry: '',
  jobTitle: '',
  hsLeadStatus: [],
  websiteUrlRequestSentFrom: '',
  dealStage: '',
})

let debouncedSave: ReturnType<typeof setTimeout> | null = null;

const loadDealData = () => {
  chrome.storage.local.get('dealData', (result) => {
    if (result.dealData) {
      if (result.dealData.editable) {
        Object.assign(dealDataEditable, JSON.parse(result.dealData.deal));
      } else {
        dealDataNotEditable.value = JSON.parse(result.dealData.deal) as IDealDataNotEditable;
      }

      store.setLoading(false);
      isDealPage.value = true;
      
    } else {
      fetchDealData()
    }
  });
};

const fetchDealData = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'GET_DEAL_DATA' }, (response) => {
        if (response.success && response.data) {
          const resp: IDealDataEditable | IDealDataNotEditable = response.data;

          if (response.editable) {
            Object.assign(dealDataEditable, resp);
            saveDealDataToStorage(resp, true);
          } else {
            dealDataNotEditable.value = resp as IDealDataNotEditable;
            saveDealDataToStorage(resp, false);
          }

          isDealPage.value = true;
          store.setLoading(false);

        } else {
          isDealPage.value = false;
          store.setLoading(false);
        }
      });
    }
  });
};

const saveDealDataToStorage = (data: IDealDataEditable | IDealDataNotEditable, isEditable: boolean) => {
  chrome.storage.local.set({ dealData:  {editable: isEditable ? 1 : 0, deal: JSON.stringify(data)} });
};

const saveDealToCRM = async () => {
  store.setLoading(true);

  try {
    const dealObj: IDealApiEditable = {
      dealname: dealDataEditable.dealName,
      amount: dealDataEditable.amount,
      lead_channel: dealDataEditable.leadChannel,
      request_type: dealDataEditable.requestType,
      description: dealDataEditable.description,
      model_of_work_type: dealDataEditable.modelOfWorkType,
      hs_analytics_source: dealDataEditable.hsAnalyticsSource,
      communication_channel: dealDataEditable.communicationChannel,
      sales_type: dealDataEditable.salesType,
      service_type: dealDataEditable.serviceType,
      client_s_language: dealDataEditable.clientsLanguage,
      contacts: {
        firstname: dealDataEditable.firstName,
        lastname: dealDataEditable.lastName,
        email: dealDataEditable.email,
        phone: dealDataEditable.phone,
        gender: dealDataEditable.gender,
        mobilephone: dealDataEditable.mobilePhone,
        work_email : dealDataEditable.workEmail,
        country: dealDataEditable.country,
        city: dealDataEditable.city,
        industry: dealDataEditable.industry,
        jobtitle: dealDataEditable.jobTitle,
        hs_lead_status: dealDataEditable.hsLeadStatus,
      },
      website_url_request_sent_from: dealDataEditable.websiteUrlRequestSentFrom,
      dealstage: dealDataEditable.dealStage,
    }

    interface ISavedDeal {
      status: number,
      data: {
        id: number | string,
        properties: IDealApiNotEditable
      }
    }

    const response: ISavedDeal = await axios.post(`${apiUrl}/deal`, dealObj, {
      headers: {
        Authorization: `Bearer ${store.token}`
      }
    });

    if (response.status === 200) {
      dealDataNotEditable.value = response.data.properties;
      saveDealDataToStorage(response.data.properties as IDealApiNotEditable, false)
    }

  } catch (error) {
    console.error('Error:', error);

  } finally {
    store.setLoading(false);
  }
};

onMounted(() => {
  if (store.isLoggedIn) {
    store.setLoading(true);
    loadDealData();
  }
});

watch(
  () => dealDataEditable,
  (newVal) => {
    if (debouncedSave) {
      clearTimeout(debouncedSave);
    }

    debouncedSave = setTimeout(() => {
      saveDealDataToStorage(newVal, true);
    }, 500);
  },
  { deep: true }
);
</script>

<template>
  <div class="popup-content">
    <Login @logged-in="loadDealData" />

    <div
      v-if="isLoggedIn && !isDealPage"
      class="popup-content__empty">
      &#128543;
    </div>


    <DealDetails
      v-if="isLoggedIn && isDealPage"
      :deal-data-editable="dealDataEditable"
      :deal-data-not-editable="dealDataNotEditable"
      @save-deal="saveDealToCRM"
    />

    <div
      v-if="isLoggedIn && isDealPage && dealDataNotEditable"
      class="popup-content__notes">
      <Notes />
    </div>

    <Loading v-if="isLoading" />

    <a href="#" @click.prevent="store.logout()" style="color: grey">Logout</a>
  </div>
</template>

<style lang="scss">
.popup-content {
  position: relative;
  z-index: 1;

  &__title {
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 1px solid #565656;
    padding-bottom: 7px;
  }

  &__empty {
    font-size: 26px;
    text-align: center;
    padding-top: 10px;
  }

  &__main {
    &.--truncated {
      .popup-content__main-content {
        height: 160px;
        overflow: hidden;
        position: relative;
        z-index: 1;

        &:after {
          content: '';
          position: absolute;
          z-index: 1;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(0, #1b1b1f, transparent);
        }
      }
    }

    &.--opened {
      .popup-content__main-content {
        height: auto;

        &:after {
          display: none;
        }
      }
    }

    &-btn {
      padding-top: 10px;
      text-align: right;
    }
  }

  &__form {
    &-btn {
      margin-top: 15px;
    }

    &-error {
      color: #ff0000;
      margin-top: 10px;
    }
  }

  &__contacts {
    margin-top: 10px;

    &-title {
      font-size: 15px;
      margin-bottom: 5px;
    }

    &-item {
      padding: 10px 10px 3px;
      border-radius: 5px;
      border: 1px solid #565656;
      margin-bottom: 8px;
    }
  }

  &__notes {
    margin-top: 15px;
  }
}
</style>
