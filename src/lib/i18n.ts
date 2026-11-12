'use client';

/**
 * Lightweight English / Myanmar translations for the customer and rider
 * apps. The choice is saved in localStorage and shared across components
 * through a window event, so no provider is needed.
 */
import { useCallback, useEffect, useState } from 'react';

export type Lang = 'en' | 'my';
const STORAGE_KEY = 'fooddash_lang';
const EVENT = 'fooddash-lang';

const en = {
  'nav.discover': 'Discover',
  'nav.orders': 'My Orders',
  'nav.cart': 'Cart',
  'nav.profile': 'Profile',
  'nav.signOut': 'Sign Out',
  'nav.menu': 'Menu',
  'lang.label': 'မြန်မာ',
  'greet.morning': 'Good morning',
  'greet.afternoon': 'Good afternoon',
  'greet.evening': 'Good evening',
  'greet.night': 'Good night',
  'greet.sub': 'What would you like today? Order food or send a parcel across Yangon.',
  'quick.parcel': 'Send a parcel',
  'quick.parcelSub': 'Door-to-door, see the price first',
  'quick.ai': 'AI Picks',
  'quick.aiSub': 'Weather, trending, your taste',
  'ai.title': 'AI Picks',
  'ai.sub': "Matched to the weather, what's trending and your taste",
  'ai.seeAll': 'See all',
  'ai.weather': 'Perfect Weather Match',
  'ai.recommended': 'Recommended for You',
  'foryou.title': 'For You',
  'foryou.learned': 'Learned from your orders and {n} orders by {c} customers',
  'foryou.cold': 'Order a few times and these picks will learn your taste. For now: most popular dishes.',
  'foryou.loading': 'Analysing your orders…',
  'foryou.taste': 'Your taste profile',
  'foryou.fromOrders': 'From your {n} orders',
  'foryou.avgOrder': 'Average order',
  'foryou.usualPrice': 'Usual dish price',
  'foryou.usualTime': 'You usually order',
  'foryou.favRestaurant': 'Favourite restaurant',
  'foryou.mostOrdered': 'Most ordered',
  'foryou.why': 'Why this?',
  'foryou.match': '{p}% match',
  'foryou.popular': 'Popular',
  'signal.collaborative': 'Similar customers',
  'signal.category': 'Your favourite category',
  'signal.repeat': 'You order it often',
  'signal.popularity': 'Popular right now',
  'signal.price': 'Fits your budget',
  'rest.title': 'Restaurants Near You',
  'rest.openNow': '{n} open now',
  'rest.within': 'Within {km} km of your delivery address',
  'push.customer': 'Get a notification when your order or parcel moves.',
  'push.rider': 'Get alerts for new deliveries and parcels near you.',
  'push.on': 'Turn on',
  'parcel.title': 'Send a parcel',
  'parcel.brand': 'FoodDash Express',
  'parcel.brandSub': 'Send anything across Yangon — a rider picks it up from your door',
  'parcel.pickup': 'Pickup',
  'parcel.dropoff': 'Drop-off',
  'parcel.search': 'Type an address, street or place',
  'parcel.pin': 'Pin on map',
  'parcel.hideMap': 'Hide map',
  'parcel.locationSet': 'Location set',
  'parcel.detail': 'Building, floor, room or landmark (optional)',
  'parcel.recipientName': 'Recipient name',
  'parcel.recipientPhone': 'Recipient phone (09…)',
  'parcel.recipientHint': 'If the recipient uses FoodDash with this phone number, they can track the parcel in their app too.',
  'parcel.size': 'Size',
  'parcel.what': 'What are you sending? (e.g. documents, clothes)',
  'parcel.note': 'Note for the rider (optional)',
  'parcel.whoPays': 'Who pays the rider (cash)?',
  'parcel.iPay': 'I pay at pickup',
  'parcel.recipientPays': 'Recipient pays at drop-off',
  'parcel.choose': 'Choose pickup and drop-off to see the price.',
  'parcel.base': 'Base fare',
  'parcel.distance': 'Distance ({km} km by road)',
  'parcel.total': 'Total',
  'parcel.ride': 'About {m} min ride once picked up.',
  'parcel.request': 'Request a rider',
  'parcel.mine': 'My parcels',
  'parcel.sent': 'Sent ({n})',
  'parcel.toMe': 'To me ({n})',
  'parcel.pinLabel': 'Delivery PIN',
  'parcel.cancel': 'Cancel request',
  'rider.home': 'Home',
  'rider.routes': 'Routes',
  'rider.parcels': 'Parcels',
  'rider.earnings': 'Earnings',
  'rider.trips': 'Trips',
  'rider.settings': 'Settings',
  'rp.title': 'Parcels',
  'rp.sub': 'Door-to-door deliveries from customers',
  'rp.inProgress': 'In progress',
  'rp.nearby': 'Nearby requests',
  'rp.goPickup': 'Go to pickup',
  'rp.deliver': 'Deliver to recipient',
  'rp.navigate': 'Navigate',
  'rp.call': 'Call {name}',
  'rp.collectSender': 'Collect {amount} cash from the sender at pickup',
  'rp.collectRecipient': 'Collect {amount} cash from the recipient at drop-off',
  'rp.pickedUp': 'I have picked up the parcel',
  'rp.pin': 'Recipient PIN',
  'rp.confirm': 'Confirm delivery',
  'rp.accept': 'Accept',
  'rp.trip': '{km} km trip',
  'rp.toPickup': '{km} km to pickup',
  'rp.goOnline': 'Go online to see parcel requests.',
  'rp.none': 'No parcel requests near you right now.',
};

type Key = keyof typeof en;

const my: Record<Key, string> = {
  'nav.discover': 'ရှာဖွေရန်',
  'nav.orders': 'ကျွန်ုပ်၏ အော်ဒါများ',
  'nav.cart': 'ခြင်းတောင်း',
  'nav.profile': 'ပရိုဖိုင်',
  'nav.signOut': 'ထွက်မည်',
  'nav.menu': 'မီနူး',
  'lang.label': 'English',
  'greet.morning': 'မင်္ဂလာနံနက်ခင်းပါ',
  'greet.afternoon': 'မင်္ဂလာနေ့လယ်ခင်းပါ',
  'greet.evening': 'မင်္ဂလာညနေခင်းပါ',
  'greet.night': 'မင်္ဂလာညပါ',
  'greet.sub': 'ဒီနေ့ ဘာစားချင်လဲ? အစားအသောက် မှာမလား၊ ရန်ကုန်တစ်မြို့လုံး ပစ္စည်းပို့မလား။',
  'quick.parcel': 'ပစ္စည်းပို့မယ်',
  'quick.parcelSub': 'အိမ်တံခါးဝအထိ၊ ဈေးကို အရင်ကြည့်',
  'quick.ai': 'AI အကြံပြုချက်',
  'quick.aiSub': 'ရာသီဥတု၊ လူကြိုက်များ၊ သင့်အကြိုက်',
  'ai.title': 'AI အကြံပြုချက်',
  'ai.sub': 'ရာသီဥတု၊ လူကြိုက်များတာနဲ့ သင့်အကြိုက်အလိုက် ရွေးပေးထားပါတယ်',
  'ai.seeAll': 'အားလုံးကြည့်',
  'ai.weather': 'ရာသီဥတုနဲ့ လိုက်ဖက်',
  'ai.recommended': 'သင့်အတွက် အကြံပြု',
  'foryou.title': 'သင့်အတွက်',
  'foryou.learned': 'သင့်အော်ဒါတွေနဲ့ customer {c} ယောက်ရဲ့ အော်ဒါ {n} ခုကနေ သင်ယူထားပါတယ်',
  'foryou.cold': 'အော်ဒါ နည်းနည်းမှာပြီးရင် သင့်အကြိုက်ကို သင်ယူပါမယ်။ အခုတော့ လူကြိုက်အများဆုံး ဟင်းတွေပါ။',
  'foryou.loading': 'သင့်အော်ဒါတွေကို ခွဲခြမ်းစိတ်ဖြာနေပါတယ်…',
  'foryou.taste': 'သင့်အစားအသောက် အကြိုက်',
  'foryou.fromOrders': 'သင့်အော်ဒါ {n} ခုမှ',
  'foryou.avgOrder': 'ပျမ်းမျှ အော်ဒါ',
  'foryou.usualPrice': 'အမြဲမှာတဲ့ ဟင်းဈေး',
  'foryou.usualTime': 'မှာလေ့ရှိတဲ့ အချိန်',
  'foryou.favRestaurant': 'အကြိုက်ဆုံး ဆိုင်',
  'foryou.mostOrdered': 'အများဆုံး မှာတာ',
  'foryou.why': 'ဘာကြောင့်လဲ?',
  'foryou.match': '{p}% ကိုက်ညီ',
  'foryou.popular': 'လူကြိုက်များ',
  'signal.collaborative': 'အကြိုက်တူ customer များ',
  'signal.category': 'သင်ကြိုက်တဲ့ အမျိုးအစား',
  'signal.repeat': 'မကြာခဏ မှာတယ်',
  'signal.popularity': 'အခု လူကြိုက်များ',
  'signal.price': 'ဘတ်ဂျက်နဲ့ ကိုက်',
  'rest.title': 'အနီးနားက စားသောက်ဆိုင်များ',
  'rest.openNow': 'ယခုဖွင့်ထား {n} ဆိုင်',
  'rest.within': 'ပို့မယ့်လိပ်စာမှ {km} km အတွင်း',
  'push.customer': 'အော်ဒါ သို့မဟုတ် ပစ္စည်း အခြေအနေ ပြောင်းတိုင်း အသိပေးချက် ရယူပါ။',
  'push.rider': 'အနီးက ပို့ဆောင်မှုအသစ်တွေအတွက် အသိပေးချက် ရယူပါ။',
  'push.on': 'ဖွင့်မည်',
  'parcel.title': 'ပစ္စည်းပို့မယ်',
  'parcel.brand': 'FoodDash Express',
  'parcel.brandSub': 'ရန်ကုန်တစ်မြို့လုံး ဘာမဆိုပို့ပါ — rider က အိမ်အထိ လာယူပေးပါမယ်',
  'parcel.pickup': 'ယူမည့်နေရာ',
  'parcel.dropoff': 'ပို့မည့်နေရာ',
  'parcel.search': 'လိပ်စာ၊ လမ်း သို့မဟုတ် နေရာ ရိုက်ထည့်ပါ',
  'parcel.pin': 'မြေပုံပေါ် ရွေးမည်',
  'parcel.hideMap': 'မြေပုံ ပိတ်မည်',
  'parcel.locationSet': 'နေရာ သတ်မှတ်ပြီး',
  'parcel.detail': 'အဆောက်အအုံ၊ အထပ်၊ အခန်း သို့မဟုတ် မှတ်သားစရာ (မဖြစ်မနေ မဟုတ်)',
  'parcel.recipientName': 'လက်ခံသူ အမည်',
  'parcel.recipientPhone': 'လက်ခံသူ ဖုန်း (09…)',
  'parcel.recipientHint': 'လက်ခံသူက ဒီဖုန်းနံပါတ်နဲ့ FoodDash သုံးရင် သူ့ app ထဲမှာလည်း ခြေရာခံလို့ ရပါတယ်။',
  'parcel.size': 'အရွယ်အစား',
  'parcel.what': 'ဘာပို့မှာလဲ? (ဥပမာ စာရွက်စာတမ်း၊ အဝတ်အစား)',
  'parcel.note': 'Rider အတွက် မှတ်ချက် (မဖြစ်မနေ မဟုတ်)',
  'parcel.whoPays': 'Rider ကို ငွေသား ဘယ်သူပေးမလဲ?',
  'parcel.iPay': 'ယူတဲ့အချိန် ကျွန်ုပ်ပေးမယ်',
  'parcel.recipientPays': 'ပို့တဲ့အချိန် လက်ခံသူပေးမယ်',
  'parcel.choose': 'ဈေးကြည့်ရန် ယူမည့်နေရာနဲ့ ပို့မည့်နေရာ ရွေးပါ။',
  'parcel.base': 'အခြေခံ ကြေး',
  'parcel.distance': 'အကွာအဝေး (လမ်းအတိုင်း {km} km)',
  'parcel.total': 'စုစုပေါင်း',
  'parcel.ride': 'ယူပြီးရင် {m} မိနစ်ခန့် ကြာမယ်။',
  'parcel.request': 'Rider ခေါ်မယ်',
  'parcel.mine': 'ကျွန်ုပ်၏ ပစ္စည်းများ',
  'parcel.sent': 'ပို့ထား ({n})',
  'parcel.toMe': 'ကျွန်ုပ်ထံ ({n})',
  'parcel.pinLabel': 'ပို့ဆောင်မှု PIN',
  'parcel.cancel': 'တောင်းဆိုမှု ပယ်ဖျက်',
  'rider.home': 'ပင်မ',
  'rider.routes': 'လမ်းကြောင်း',
  'rider.parcels': 'ပစ္စည်း',
  'rider.earnings': 'ဝင်ငွေ',
  'rider.trips': 'ခရီးစဉ်',
  'rider.settings': 'ဆက်တင်',
  'rp.title': 'ပစ္စည်း ပို့ဆောင်မှု',
  'rp.sub': 'Customer တွေရဲ့ အိမ်တံခါးဝ ပို့ဆောင်မှုများ',
  'rp.inProgress': 'လုပ်ဆောင်ဆဲ',
  'rp.nearby': 'အနီးက တောင်းဆိုမှုများ',
  'rp.goPickup': 'ပစ္စည်းယူရန် သွားပါ',
  'rp.deliver': 'လက်ခံသူထံ ပို့ပါ',
  'rp.navigate': 'လမ်းညွှန်',
  'rp.call': '{name} ကို ဖုန်းခေါ်',
  'rp.collectSender': 'ယူတဲ့အချိန် ပို့သူထံမှ ငွေသား {amount} ကောက်ပါ',
  'rp.collectRecipient': 'ပို့တဲ့အချိန် လက်ခံသူထံမှ ငွေသား {amount} ကောက်ပါ',
  'rp.pickedUp': 'ပစ္စည်း ယူပြီးပါပြီ',
  'rp.pin': 'လက်ခံသူ PIN',
  'rp.confirm': 'ပို့ပြီးကြောင်း အတည်ပြု',
  'rp.accept': 'လက်ခံမည်',
  'rp.trip': '{km} km ခရီး',
  'rp.toPickup': 'ယူမည့်နေရာထိ {km} km',
  'rp.goOnline': 'ပစ္စည်း တောင်းဆိုမှုများ မြင်ရန် Online ဖွင့်ပါ။',
  'rp.none': 'အခု အနီးမှာ ပစ္စည်း တောင်းဆိုမှု မရှိသေးပါ။',
};


/**
 * Phrase translations for the restaurant, admin and checkout screens:
 * `tx('Orders')` returns the Myanmar text when Myanmar is chosen and the
 * English text otherwise (also when a phrase has no translation yet).
 */
const phrasesMy: Record<string, string> = {
  // Restaurant portal
  Dashboard: 'ဒက်ရှ်ဘုတ်',
  Orders: 'အော်ဒါများ',
  Menu: 'မီနူး',
  Profile: 'ပရိုဖိုင်',
  'Sign Out': 'ထွက်မည်',
  Analytics: 'ခွဲခြမ်းစိတ်ဖြာမှု',
  'Active Orders': 'လက်ရှိ အော်ဒါများ',
  Active: 'လက်ရှိ',
  History: 'မှတ်တမ်း',
  Accept: 'လက်ခံမည်',
  Reject: 'ငြင်းမည်',
  'Mark Ready': 'အဆင်သင့်ဖြစ်ပြီ',
  'No active orders': 'လက်ရှိ အော်ဒါ မရှိပါ',
  'No order history yet': 'အော်ဒါ မှတ်တမ်း မရှိသေးပါ',
  'New orders will appear here in real-time': 'အော်ဒါအသစ်များ ဒီမှာ ချက်ချင်း ပေါ်လာပါမည်',
  'Loading orders…': 'အော်ဒါများ ဖွင့်နေသည်…',
  'Shop analytics': 'ဆိုင် ခွဲခြမ်းစိတ်ဖြာမှု',
  'Top dishes': 'အရောင်းရဆုံး ဟင်းများ',
  'Busiest hours': 'အလုပ်အများဆုံး အချိန်များ',
  'Weather effect': 'ရာသီဥတု သက်ရောက်မှု',
  'Repeat customers': 'ပြန်လာဝယ်သူများ',
  'Average rating': 'ပျမ်းမျှ အဆင့်သတ်မှတ်ချက်',
  'Rainy days': 'မိုးရွာသည့်နေ့များ',
  'Dry days': 'မိုးမရွာသည့်နေ့များ',
  // Admin
  Operations: 'လုပ်ငန်းဆောင်ရွက်မှု',
  Overview: 'အကျဉ်းချုပ်',
  Inbox: 'စာတိုက်',
  'Service Zones': 'ဝန်ဆောင်မှု ဇုန်များ',
  People: 'လူများ',
  Vendors: 'ဆိုင်များ',
  Riders: 'Rider များ',
  'User Lookup': 'အသုံးပြုသူ ရှာဖွေ',
  System: 'စနစ်',
  Configuration: 'ဆက်တင်များ',
  Marketing: 'စျေးကွက်ရှာဖွေရေး',
  'Promo Codes': 'Promo Code များ',
  'System Health': 'စနစ် ကျန်းမာရေး',
  // Cart & checkout
  Cart: 'ခြင်းတောင်း',
  Checkout: 'ငွေရှင်းမည်',
  Subtotal: 'စုစုပေါင်း (အစားအစာ)',
  Discount: 'လျှော့စျေး',
  Total: 'စုစုပေါင်း',
  'Select All': 'အားလုံး ရွေးမည်',
  'Promo Code': 'Promo Code',
  Apply: 'သုံးမည်',
  'Delivery fee': 'ပို့ခ',
  'Grand Total': 'ကျသင့်ငွေ စုစုပေါင်း',
  'Payment Method': 'ငွေပေးချေမှု နည်းလမ်း',
  'Cash on Delivery': 'ရောက်မှ ငွေချေ',
  'Tip Rider': 'Rider ကို Tip ပေးမည်',
  'Loyalty points': 'Loyalty point များ',
  When: 'ဘယ်အချိန်',
  'As soon as possible': 'အမြန်ဆုံး',
  'Schedule for later': 'အချိန်ကြိုရွေးမည်',
  'Group order': 'အဖွဲ့လိုက် မှာမည်',
  'Voice order': 'အသံဖြင့် မှာမည်',
  'Diet filter': 'အစားအသောက် စစ်ထုတ်မှု',
  Vegetarian: 'သက်သတ်လွတ်',
  Halal: 'ဟလာလ်',
  'Not spicy': 'မစပ်',
  'Under 500 kcal': 'ကယ်လိုရီ 500 အောက်',
  'My points & codes': 'ငါ့ point နှင့် code များ',
  Earnings: 'ဝင်ငွေ',
};

const dict: Record<Lang, Record<Key, string>> = { en, my };

function readLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem(STORAGE_KEY) === 'my' ? 'my' : 'en';
}

export function setLang(lang: Lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event(EVENT));
}

/** `const { t, lang } = useT(); t('nav.cart')` or `t('rest.openNow', { n: 3 })`. */
export function useT() {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    const sync = () => setLangState(readLang());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const t = useCallback(
    (key: Key, vars?: Record<string, string | number>) => {
      let text = dict[lang][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
      return text;
    },
    [lang]
  );
  const tx = useCallback(
    (english: string) => (lang === 'my' ? phrasesMy[english] ?? english : english),
    [lang]
  );
  return { t, tx, lang };
}
