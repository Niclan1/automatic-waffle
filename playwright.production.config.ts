import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/production',timeout:60000,use:{baseURL:'http://127.0.0.1:1430',browserName:'chromium',headless:true},webServer:{command:'node tests/serve-dist.mjs',url:'http://127.0.0.1:1430',reuseExistingServer:false}});
