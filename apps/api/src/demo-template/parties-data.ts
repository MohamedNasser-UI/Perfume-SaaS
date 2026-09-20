export type SupplierDef = {
  key: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  creditTerms: string;
  creditLimit: number;
  notes: string;
};

export type CustomerDef = {
  name: string;
  mobile: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  notes?: string;
};

export const SUPPLIERS: SupplierDef[] = [
  {
    key: "oils-fajr",
    name: "مؤسسة الفجر للزيوت العطرية",
    contactPerson: "حسن عبد الله",
    phone: "01011112222",
    address: "شارع الجمهورية، وسط البلد، القاهرة",
    creditTerms: "30 يوم",
    creditLimit: 150000,
    notes: "demo@fajr-oils.example | مورد زيوت رئيسي",
  },
  {
    key: "nile-pack",
    name: "شركة وادي النيل للتغليف",
    contactPerson: "محمود السيد",
    phone: "01122223333",
    address: "المنطقة الصناعية، السادس من أكتوبر، الجيزة",
    creditTerms: "15 يوم",
    creditLimit: 80000,
    notes: "pack@nile-wrap.example | زجاجات وعبوات",
  },
  {
    key: "orient-scents",
    name: "تجارة العطور الشرقية",
    contactPerson: "ياسر كمال",
    phone: "01233334444",
    address: "شارع الهرم، الجيزة",
    creditTerms: "45 يوم",
    creditLimit: 200000,
    notes: "orders@orient-scents.example | عطور جاهزة",
  },
  {
    key: "delta-chem",
    name: "مختبرات الدلتا للكيماويات",
    contactPerson: "سارة فؤاد",
    phone: "01544445555",
    address: "برج العرب، الإسكندرية",
    creditTerms: "30 يوم",
    creditLimit: 100000,
    notes: "sales@delta-chem.example | كحول ومثبتات",
  },
  {
    key: "cairo-glass",
    name: "مصنع القاهرة للزجاج الفاخر",
    contactPerson: "عمر نبيل",
    phone: "01055556666",
    address: "شبرا الخيمة، القليوبية",
    creditTerms: "21 يوم",
    creditLimit: 90000,
    notes: "info@cairo-glass.example",
  },
  {
    key: "luxor-aroma",
    name: "عطور الأقصر للتجارة",
    contactPerson: "فاطمة حسين",
    phone: "01166667777",
    address: "كورنيش النيل، الأقصر",
    creditTerms: "30 يوم",
    creditLimit: 120000,
    notes: "trade@luxor-aroma.example | زيوت شرقية",
  },
  {
    key: "alex-premium",
    name: "مؤسسة الإسكندرية المميزة",
    contactPerson: "كريم منصور",
    phone: "01277778888",
    address: "سموحة، الإسكندرية",
    creditTerms: "14 يوم",
    creditLimit: 75000,
    notes: "premium@alex-scents.example",
  },
];

/** Egyptian Arabic customer names + Egyptian mobiles */
export const CUSTOMERS: CustomerDef[] = [
  { name: "محمد عبد الرحمن", mobile: "01012345678", gender: "MALE" },
  { name: "سارة إبراهيم", mobile: "01123456789", gender: "FEMALE" },
  { name: "يوسف كمال", mobile: "01234567890", gender: "MALE" },
  { name: "نورة السيد", mobile: "01555551234", gender: "FEMALE" },
  { name: "أحمد حسن محمود", mobile: "01098765432", gender: "MALE" },
  { name: "فاطمة علي", mobile: "01187654321", gender: "FEMALE" },
  { name: "عمر خالد", mobile: "01276543210", gender: "MALE" },
  { name: "مريم أحمد", mobile: "01565432109", gender: "FEMALE" },
  { name: "حسام الدين فؤاد", mobile: "01011223344", gender: "MALE" },
  { name: "دينا محمود", mobile: "01122334455", gender: "FEMALE" },
  { name: "كريم مصطفى", mobile: "01233445566", gender: "MALE" },
  { name: "هدى عبد العزيز", mobile: "01544556677", gender: "FEMALE" },
  { name: "طارق نبيل", mobile: "01055667788", gender: "MALE" },
  { name: "لينا سمير", mobile: "01166778899", gender: "FEMALE" },
  { name: "باسم رضا", mobile: "01277889900", gender: "MALE" },
  { name: "ياسمين فتحي", mobile: "01588990011", gender: "FEMALE" },
  { name: "عبد الله جمال", mobile: "01099001122", gender: "MALE" },
  { name: "رانيا حسني", mobile: "01100112233", gender: "FEMALE" },
];
