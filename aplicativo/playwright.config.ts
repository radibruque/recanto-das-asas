import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const preview=process.env.RECANTO_E2E_PREVIEW==='1';
const baseURL=preview?'http://127.0.0.1:5175':'http://127.0.0.1:5174';
export default defineConfig({testDir:'tests/e2e',timeout:60000,expect:{timeout:15000},workers:1,use:{baseURL,browserName:'chromium',launchOptions:{executablePath:process.env.RECANTO_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)},acceptDownloads:true},webServer:{command:preview?'npm run preview -- --port 5175 --strictPort':'npm run dev',url:baseURL,reuseExistingServer:true,timeout:30000}});
