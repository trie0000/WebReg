// 英語版リスト用の翻訳表。組織名(マスタの英語列)以外の SP 上の英語表記をここで用意する。
// 内部列名(InternalName)は日本語版と同じ。表示名(DisplayName)と選択肢値だけを英語にする。

// 列の表示名(internal → 英語表示名)
const EN_FIELD_TITLE = {
  Title: 'User Name',
  Company: 'Company',
  Email: 'Email',
  ChangeType: 'Change Type',
  Permission: 'Permission',
  OrgLevel1: 'Org Division 1',
  OrgLevel2: 'Org Division 2',
  Notes: 'Notes',
  AppliedDate: 'Applied Date',
  SystemDeleted: 'System Deleted',
  L2All: 'All Org Division 2',
  WorkStatus: 'Work Status',
};

// 選択肢値(日本語値 → 英語値)。未知の値はそのまま使う
const EN_CHANGE_TYPE = {
  追加: 'Add', 新規: 'New', 変更: 'Change', 更新: 'Update', 削除: 'Delete', 変更なし: 'No Change',
};
const EN_PERMISSION = { 更新者: 'Editor', 閲覧者: 'Viewer', 参照者: 'Reader' };
const EN_WORK_STATUS = { 作業待ち: 'Pending', 改廃済み: 'Done', 結果確認済み: 'Verified' };

// 言語別の文言(リスト説明など)
const EN_LIST_DESC = 'User permission registry (English)';

// 値を英語へ変換(対応が無ければ原値)
const toEnChangeType = (v) => EN_CHANGE_TYPE[v] || v || '';
const toEnPermission = (v) => EN_PERMISSION[v] || v || '';
const toEnWorkStatus = (v) => EN_WORK_STATUS[v] || v || WORK_STATUS_DEFAULT;
const enFieldTitle = (internal, jaTitle) => EN_FIELD_TITLE[internal] || jaTitle;

// マスタの英語名(無ければ日本語名)
const l1NameOf = (x, lang) => (lang === 'en' ? (x.TitleEn || x.Title) : x.Title);
const l2NameOf = (x, lang) => (lang === 'en' ? (x.TitleEn || x.Title) : x.Title);
