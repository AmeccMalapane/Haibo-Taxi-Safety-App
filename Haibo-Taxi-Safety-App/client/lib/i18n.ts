import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Haibo! South African Localization Module
 * Supports: English, isiZulu, isiXhosa, Sesotho, Afrikaans
 */

export type SupportedLanguage = "en" | "zu" | "xh" | "st" | "af";

const LANGUAGE_KEY = "@haibo_language";

export const LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "zu", name: "Zulu", nativeName: "isiZulu" },
  { code: "xh", name: "Xhosa", nativeName: "isiXhosa" },
  { code: "st", name: "Sotho", nativeName: "Sesotho" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans" },
];

type TranslationKeys = {
  // General
  appName: string;
  welcome: string;
  loading: string;
  cancel: string;
  confirm: string;
  save: string;
  delete: string;
  edit: string;
  back: string;
  next: string;
  done: string;
  search: string;
  share: string;
  settings: string;

  // Navigation
  home: string;
  routes: string;
  wallet: string;
  community: string;
  safety: string;

  // Onboarding
  onboardingTitle1: string;
  onboardingDesc1: string;
  onboardingTitle2: string;
  onboardingDesc2: string;
  onboardingTitle3: string;
  onboardingDesc3: string;
  onboardingTitle4: string;
  onboardingDesc4: string;
  getStarted: string;
  skip: string;

  // Role selection
  howDoYouTravel: string;
  commuter: string;
  taxiDriver: string;
  commuterDesc: string;
  driverDesc: string;

  // SOS
  sosTitle: string;
  sosActivated: string;
  sosCancel: string;
  emergencyContacts: string;

  // Wallet
  balance: string;
  topUp: string;
  transfer: string;
  withdraw: string;
  transactionHistory: string;

  // Community
  communityHub: string;
  liveAlerts: string;
  events: string;
  groupRides: string;
  lostAndFound: string;

  // Driver
  driverRegistration: string;
  plateNumber: string;
  yourName: string;
  registerAndDrive: string;
  payReference: string;
};

const translations: Record<SupportedLanguage, TranslationKeys> = {
  en: {
    appName: "Haibo!",
    welcome: "Welcome to Haibo!",
    loading: "Loading...",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    next: "Next",
    done: "Done",
    search: "Search",
    share: "Share",
    settings: "Settings",
    home: "Home",
    routes: "Routes",
    wallet: "Wallet",
    community: "Community",
    safety: "Safety",
    onboardingTitle1: "Safety First",
    onboardingDesc1: "Tap SOS for emergency help. Your location is shared instantly with emergency contacts.",
    onboardingTitle2: "Smart Navigation",
    onboardingDesc2: "Find optimal routes with real-time taxi locations and estimated fares.",
    onboardingTitle3: "Community Power",
    onboardingDesc3: "Connect with fellow commuters for shared rides and community updates.",
    onboardingTitle4: "Haibo Pay",
    onboardingDesc4: "Secure digital payments. Top up, transfer, and pay fares — no cash needed.",
    getStarted: "Get Started",
    skip: "Skip",
    howDoYouTravel: "How do you travel?",
    commuter: "Commuter",
    taxiDriver: "Taxi Driver",
    commuterDesc: "Find routes, pay fares, and stay safe",
    driverDesc: "Track routes, earn with Haibo Pay",
    sosTitle: "Emergency SOS",
    sosActivated: "SOS Activated! Help is on the way.",
    sosCancel: "Hold to Cancel",
    emergencyContacts: "Emergency Contacts",
    balance: "Balance",
    topUp: "Top Up",
    transfer: "Transfer",
    withdraw: "Withdraw",
    transactionHistory: "Transaction History",
    communityHub: "Community Hub",
    liveAlerts: "Live Alerts",
    events: "Events",
    groupRides: "Group Rides",
    lostAndFound: "Lost & Found",
    driverRegistration: "Driver Registration",
    plateNumber: "Taxi Plate Number",
    yourName: "Your Name",
    registerAndDrive: "Register & Start Driving",
    payReference: "Haibo Pay Reference",
  },
  zu: {
    appName: "Haibo!",
    welcome: "Siyakwamukela ku-Haibo!",
    loading: "Iyalayisha...",
    cancel: "Khansela",
    confirm: "Qinisekisa",
    save: "Gcina",
    delete: "Susa",
    edit: "Hlela",
    back: "Emuva",
    next: "Okulandelayo",
    done: "Kwenziwe",
    search: "Sesha",
    share: "Yabelana",
    settings: "Izilungiselelo",
    home: "Ikhaya",
    routes: "Imizila",
    wallet: "Isikhwama",
    community: "Umphakathi",
    safety: "Ukuphepha",
    onboardingTitle1: "Ukuphepha Kuqala",
    onboardingDesc1: "Cindezela i-SOS ukuthola usizo olusheshayo. Indawo yakho yabiwa ngokushesha.",
    onboardingTitle2: "Ukuzulazula Okuhlakaniphile",
    onboardingDesc2: "Thola imizila engcono kakhulu namanani etekisi.",
    onboardingTitle3: "Amandla Omphakathi",
    onboardingDesc3: "Xhumana nabanye abagibeli ukuze nihambe ndawonye.",
    onboardingTitle4: "Haibo Pay",
    onboardingDesc4: "Ukukhokha okuvikelekile ngedijithali. Faka imali, dlulisa, ukhokhe.",
    getStarted: "Qala Manje",
    skip: "Yeqa",
    howDoYouTravel: "Uhamba kanjani?",
    commuter: "Umgibeli",
    taxiDriver: "Umshayeli Wetekisi",
    commuterDesc: "Thola imizila, khokha, uphepha",
    driverDesc: "Landelela imizila, uzuze nge-Haibo Pay",
    sosTitle: "I-SOS Yesimo Esiphuthumayo",
    sosActivated: "I-SOS isebenzile! Usizo luyeza.",
    sosCancel: "Bamba Ukukhansela",
    emergencyContacts: "Abaxhumana Nabo Ngokuphuthumayo",
    balance: "Ibhalansi",
    topUp: "Faka Imali",
    transfer: "Dlulisa",
    withdraw: "Khipha",
    transactionHistory: "Umlando Wezinkokhelo",
    communityHub: "Isikhungo Somphakathi",
    liveAlerts: "Izexwayiso Zangempela",
    events: "Imicimbi",
    groupRides: "Ukuhamba Ngeqembu",
    lostAndFound: "Okulahlekile Nokutholakele",
    driverRegistration: "Ukubhaliswa Komshayeli",
    plateNumber: "Inombolo Yepuleti Letekisi",
    yourName: "Igama Lakho",
    registerAndDrive: "Bhalisa Uqale Ukushayela",
    payReference: "Ireferensi ye-Haibo Pay",
  },
  xh: {
    appName: "Haibo!",
    welcome: "Wamkelekile ku-Haibo!",
    loading: "Iyalayisha...",
    cancel: "Rhoxisa",
    confirm: "Qinisekisa",
    save: "Gcina",
    delete: "Cima",
    edit: "Hlela",
    back: "Emva",
    next: "Okulandelayo",
    done: "Kwenziwe",
    search: "Khangela",
    share: "Yabelana",
    settings: "Izicwangciso",
    home: "Ikhaya",
    routes: "Iindlela",
    wallet: "Isipaji",
    community: "Uluntu",
    safety: "Ukhuseleko",
    onboardingTitle1: "Ukhuseleko Kuqala",
    onboardingDesc1: "Cofa i-SOS ukufumana uncedo olukhawulezileyo.",
    onboardingTitle2: "Ukuhamba Ngobuchule",
    onboardingDesc2: "Fumana iindlela ezilungileyo namanani etekisi.",
    onboardingTitle3: "Amandla Oluntu",
    onboardingDesc3: "Dibanisa nabanye abakhweli ukuze nihambe kunye.",
    onboardingTitle4: "Haibo Pay",
    onboardingDesc4: "Intlawulo ekhuselekileyo yedijithali.",
    getStarted: "Qala Ngoku",
    skip: "Tsiba",
    howDoYouTravel: "Uhamba njani?",
    commuter: "Umkhweli",
    taxiDriver: "Umqhubi Wetekisi",
    commuterDesc: "Fumana iindlela, hlawula, ukhuseleke",
    driverDesc: "Landela iindlela, zuzela nge-Haibo Pay",
    sosTitle: "I-SOS Yongxamiseko",
    sosActivated: "I-SOS isebenzile! Uncedo luyeza.",
    sosCancel: "Bamba Ukurhoxisa",
    emergencyContacts: "Abanxibelelwano Bongxamiseko",
    balance: "Ibhalansi",
    topUp: "Faka Imali",
    transfer: "Dlulisela",
    withdraw: "Khupha",
    transactionHistory: "Imbali Yentlawulo",
    communityHub: "Iziko Loluntu",
    liveAlerts: "Izilumkiso Zangoku",
    events: "Imisitho",
    groupRides: "Ukuhamba Ngeqela",
    lostAndFound: "Okulahlekileyo Nokufunyenweyo",
    driverRegistration: "Ubhaliso Lomqhubi",
    plateNumber: "Inombolo Yepleti Yetekisi",
    yourName: "Igama Lakho",
    registerAndDrive: "Bhalisa Uqale Ukuqhuba",
    payReference: "Ireferensi ye-Haibo Pay",
  },
  st: {
    appName: "Haibo!",
    welcome: "Re a o amohela ho Haibo!",
    loading: "E a laela...",
    cancel: "Hlakola",
    confirm: "Netefatsa",
    save: "Boloka",
    delete: "Hlakola",
    edit: "Fetola",
    back: "Morao",
    next: "E latelang",
    done: "Ho entswe",
    search: "Batla",
    share: "Arolelana",
    settings: "Litlhophiso",
    home: "Lehae",
    routes: "Litsela",
    wallet: "Mokotla",
    community: "Setjhaba",
    safety: "Polokeho",
    onboardingTitle1: "Polokeho Pele",
    onboardingDesc1: "Tobetsa SOS ho fumana thuso e potlakileng.",
    onboardingTitle2: "Ho Tsamaea ka Bohlale",
    onboardingDesc2: "Fumana litsela tse ntle le litjeo tsa litaxi.",
    onboardingTitle3: "Matla a Setjhaba",
    onboardingDesc3: "Ikopanye le bapalami ba bang ho tsamaea hammoho.",
    onboardingTitle4: "Haibo Pay",
    onboardingDesc4: "Tefo e sireletsehileng ea dijithale.",
    getStarted: "Qala Hona Joale",
    skip: "Tlola",
    howDoYouTravel: "O tsamaea joang?",
    commuter: "Mopalami",
    taxiDriver: "Mokhaanni oa Tekisi",
    commuterDesc: "Fumana litsela, lefa, o sireletsehe",
    driverDesc: "Latela litsela, fumana ka Haibo Pay",
    sosTitle: "SOS ea Tšohanyetso",
    sosActivated: "SOS e sebetsa! Thuso e tla fihla.",
    sosCancel: "Tshwara ho Hlakola",
    emergencyContacts: "Lintlha tsa Tšohanyetso",
    balance: "Bolenanyana",
    topUp: "Kenya Chelete",
    transfer: "Fetisetsa",
    withdraw: "Ntsha",
    transactionHistory: "Nalane ea Litefo",
    communityHub: "Setsi sa Setjhaba",
    liveAlerts: "Litemoso tsa Hona Joale",
    events: "Liketsahalo",
    groupRides: "Ho Tsamaea ka Sehlopha",
    lostAndFound: "Tse Lahlehileng le tse Fumanoeng",
    driverRegistration: "Ngoliso ea Mokhaanni",
    plateNumber: "Nomoro ea Poleit ea Tekisi",
    yourName: "Lebitso la Hao",
    registerAndDrive: "Ngolisa 'me o Qale ho Khaanna",
    payReference: "Referense ea Haibo Pay",
  },
  af: {
    appName: "Haibo!",
    welcome: "Welkom by Haibo!",
    loading: "Laai tans...",
    cancel: "Kanselleer",
    confirm: "Bevestig",
    save: "Stoor",
    delete: "Verwyder",
    edit: "Wysig",
    back: "Terug",
    next: "Volgende",
    done: "Klaar",
    search: "Soek",
    share: "Deel",
    settings: "Instellings",
    home: "Tuis",
    routes: "Roetes",
    wallet: "Beursie",
    community: "Gemeenskap",
    safety: "Veiligheid",
    onboardingTitle1: "Veiligheid Eerste",
    onboardingDesc1: "Tik SOS vir noodhulp. Jou ligging word onmiddellik gedeel.",
    onboardingTitle2: "Slim Navigasie",
    onboardingDesc2: "Vind die beste roetes met intydse taxi-liggings en tariewe.",
    onboardingTitle3: "Gemeenskapskrag",
    onboardingDesc3: "Verbind met mede-pendelaars vir gedeelde ritte.",
    onboardingTitle4: "Haibo Pay",
    onboardingDesc4: "Veilige digitale betalings. Laai op, oorplaas, en betaal.",
    getStarted: "Begin Nou",
    skip: "Slaan Oor",
    howDoYouTravel: "Hoe reis jy?",
    commuter: "Pendelaar",
    taxiDriver: "Taxibestuurder",
    commuterDesc: "Vind roetes, betaal tariewe, bly veilig",
    driverDesc: "Volg roetes, verdien met Haibo Pay",
    sosTitle: "Nood-SOS",
    sosActivated: "SOS geaktiveer! Hulp is op pad.",
    sosCancel: "Hou om te Kanselleer",
    emergencyContacts: "Noodkontakte",
    balance: "Balans",
    topUp: "Laai Op",
    transfer: "Oorplaas",
    withdraw: "Onttrek",
    transactionHistory: "Transaksiegeskiedenis",
    communityHub: "Gemeenskapsentrum",
    liveAlerts: "Lewendige Waarskuwings",
    events: "Geleenthede",
    groupRides: "Groepsritte",
    lostAndFound: "Verlore & Gevind",
    driverRegistration: "Bestuurderregistrasie",
    plateNumber: "Taxi-nommerbord",
    yourName: "Jou Naam",
    registerAndDrive: "Registreer & Begin Bestuur",
    payReference: "Haibo Pay Verwysing",
  },
};

let currentLanguage: SupportedLanguage = "en";

export async function initLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored && translations[stored as SupportedLanguage]) {
      currentLanguage = stored as SupportedLanguage;
    }
  } catch {
    currentLanguage = "en";
  }
  return currentLanguage;
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  currentLanguage = lang;
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function t(key: keyof TranslationKeys): string {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

export function getTranslations(lang?: SupportedLanguage): TranslationKeys {
  return translations[lang || currentLanguage] || translations.en;
}
