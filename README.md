# Adrian Yeh Photography — 中英雙語攝影作品集

精品攝影作品集，搭配可永久保存照片的管理後台。

## 網站與作品管理

- 主頁 `/`：暖白攝影書、橫向導覽、不對稱封面與作品排版、炭黑作品系列、影像保留原色。舊的 `/v2` 連結仍可開啟同一個主頁。
- 中／EN 小型切換涵蓋前台、登入與後台，並記住這台裝置的語言選擇。
- 後台可選填英文標題、地點與說明；英文版優先使用英文內容，空白時沿用原文。
- 前台：作品分類、系列、照片放大、鍵盤／觸控切換、手機版、空分類提示、載入重試。
- 登入入口 `/login`：未登入顯示登入頁，已登入可直接進入後台，也可以登出。
- 後台 `/admin`：批次拖曳上傳、標題／分類／地點／日期／說明、草稿／公開、首頁封面、排序、刪除。
- 原始 JPG、PNG、WebP 存在 R2；縮圖與大圖在上傳時產生。
- 示意照片已標示作者與來源。首次公開自己的作品後，前台改用自己的作品。
- 更新既有部署時，先執行 D1 migrations，新增英文欄位；既有照片與原文內容會保留。

## 在自己的 Cloudflare 帳號部署

這是帶有後端的網站，使用 **Cloudflare Workers + D1 + R2 + Access**。不要把整包當作純靜態網站拖進 Pages。

### 建置錯誤修正

如果舊版部署記錄顯示 `ENOENT: no such file or directory, lstat '.openai/hosting.json'`，請以本包的 `scripts/build.mjs` 取代 GitHub 儲存庫中的同名檔案，再重新執行 `npm run build`。修正版在缺少該檔案時仍可建置；自己的 Cloudflare 部署使用根目錄的 `wrangler.jsonc`。請保留你已填好的資料庫、照片空間與登入設定。

| 資源 | 用途 | 程式綁定名稱 |
|---|---|---|
| Worker | 網站、管理 API、照片讀取 | — |
| D1 `photography-db` | 標題、分類、公開狀態、排序、封面 | `DB` |
| R2 `photography-images` | 原始照片與預覽圖 | `BUCKET` |
| Cloudflare Access | 後台登入 | JWT 驗證 |

### 1. 安裝並登入

安裝 Node.js 22 或更新版本，解壓 ZIP。在解壓後的專案資料夾開啟 PowerShell 或終端機：

```powershell
npm ci
npx wrangler login
```

登入你要部署網站的 Cloudflare 帳號。

### 2. 建立作品資料庫與照片空間

```powershell
npx wrangler d1 create photography-db
npx wrangler r2 bucket create photography-images
```

將第一個指令回傳的 `database_id` 貼到 `wrangler.jsonc` 的 `d1_databases[0].database_id`。

如果這兩個資源已存在，直接使用既有資源；若你更改名稱，請同步修改 `wrangler.jsonc` 的 `database_name` 或 `bucket_name`。

R2 Bucket 保持私有，無須開啟 Public Access。照片由 Worker 提供，草稿會驗證管理員權限。

### 3. 建立資料表並部署

```powershell
npx wrangler d1 migrations apply photography-db --remote
npm run deploy
```

資料庫 migration 會建立資料表，不會匯入示意照片。

前台會使用部署指令回傳的網站網址。登入設定尚未完成時，後台操作會保持關閉。

### 4. 設定後台登入

推薦將自己的網域接到 Worker，例如 `photos.example.com`，並在 Cloudflare Zero Trust / Access 建立 Self-hosted Application：

- 在同一個 Application 加入兩個受保護路徑：
  - `photos.example.com/admin*`
  - `photos.example.com/api/admin*`
- Allow Policy 只允許你的管理員 Email。
- 使用 Email One-time PIN 或你已設定的登入提供者。
- 登入頁 `/login`、前台 `/`、公開照片 `/media/*` 不加入這個 Access Application。
- 登入頁的按鈕會開啟受保護的 `/admin`，由 Access 提供 Email One-time PIN 登入。僅允許管理員 Email；不需要另建網站密碼。
- 取得 Access 的 Team Domain 與該 Application 的 Audience (AUD) Tag。

修改 `wrangler.jsonc` 的 `vars`：

```json
{
  "AUTH_MODE": "cloudflare",
  "ADMIN_EMAILS": "你的管理員Email",
  "ACCESS_TEAM_DOMAIN": "https://你的team名稱.cloudflareaccess.com",
  "ACCESS_AUD": "該AccessApplication的AUD"
}
```

Team Domain 不要填作品集網域。`ADMIN_EMAILS` 必須與 Access 登入的 Email 一致；多位管理員可用逗號分隔。自己的 Cloudflare 部署請保留 `AUTH_MODE: cloudflare`。

重新部署以套用設定：

```powershell
npm run deploy
```

此時可從 `https://你的作品集網域/login` 按「登入作品管理」，使用 Email 一次性驗證碼登入。已有有效登入時會直接顯示「進入作品管理」。

直接開啟 `/admin` 也必須通過驗證；登入失效後會隱藏作品管理介面並顯示重新登入入口。登出由 Access 清除登入狀態，登出後重新開啟後台必須再驗證。

預覽網站使用 ChatGPT 登入；下載包預設使用你自己的 Cloudflare Access。Worker 會驗證 Access Token 簽章、Issuer、Audience、有效期與管理員 Email，不會只信任一個 Email Header。

官方參考：
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/r2/objects/upload-objects/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

## 日常上傳作品

1. 開啟 `/login`，按「登入作品管理」完成驗證。
2. 選擇分類，拖曳照片或按「選擇照片」。可一次選多張。
3. 新照片先儲存為草稿。
4. 點「編輯作品」，填寫標題、地點、日期、說明。
5. 勾選「公開這張作品」，按「儲存變更」。
6. 已公開作品可設定為首頁封面。未指定封面時使用第一張公開作品。
7. 按「調整排序」，拖曳卡片或使用向前／向後移動按鈕，再按「儲存排序」。

每張照片最多 15 MB，支援 JPG、PNG、WebP。RAW、HEIC 請先匯出成支援格式。

「取消公開」保留照片；「刪除作品」會刪除資料與 R2 照片。系統會在刪除前要求確認。

草稿預覽使用受保護的 `/api/admin/media/*`，不會混入公開作品清單。

## 更新網站

作品的上傳、編輯、排序與公開，不需要重新部署。

只有修改網站程式、版面或設定時，才執行：

```powershell
npm run deploy
```

修改資料表時，先產生新增 migration，再套用；保留已套用的 migration 不變：

```powershell
npm run db:generate
npx wrangler d1 migrations apply photography-db --remote
npm run deploy
```

## 檔案位置

| 路徑 | 內容 |
|---|---|
| `public/index.html` / `v2.css` / `v2.js` | 主頁攝影藝廊 |
| `public/i18n.js` / `i18n.css` | 前台、登入與後台的中英切換 |
| `public/admin.html` / `admin.css` / `admin.js` | 管理後台 |
| `worker/` | API、登入驗證、作品與照片權限 |
| `db/schema.ts` / `drizzle/` | 資料表定義與 migration |
| `wrangler.jsonc` | 自己 Cloudflare 的部署設定 |
| `IMAGE-CREDITS.md` | 示意照片來源與授權 |

本下載包未包含任何登入密碼、API Token 或已上傳的私人作品。示意素材為 Unsplash 攝影作品，不是 Adrian Yeh 本人的作品。

## 開發驗證

```powershell
npm run build
node tests/build.mjs
npm test
node tests/i18n.mjs
```

整合測試使用本機 Cloudflare Workers 執行環境與獨立測試 D1／R2，驗證上傳、資料保存、草稿權限、公開、封面、排序、刪除、版本衝突與 Access JWT 驗證；不會寫入正式作品。
