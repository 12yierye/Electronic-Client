<template>
  <div class="settings-view">
    <div class="settings-layout">
      <div class="settings-sidebar">
        <div
          v-for="item in navItems"
          :key="item.key"
          :class="['settings-nav-item', { active: activeNav === item.key }]"
          @click="activeNav = item.key"
        >
          <el-icon v-if="item.icon" class="nav-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </div>
      </div>

      <div class="settings-content">
        <!-- 用户 -->
        <div v-if="activeNav === 'profile'">
          <UserProfile />
          <el-divider />
          <div class="settings-section">
            <h3>隐私与加密</h3>
            <el-form-item label="端到端加密：">
              <el-radio-group v-model="e2eEncryption" @change="handleE2EChange">
                <el-radio-button value="off">
                  <el-icon><Lock /></el-icon>
                  关闭
                </el-radio-button>
                <el-radio-button value="lan">
                  <el-icon><Lock /></el-icon>
                  仅内网对话
                </el-radio-button>
                <el-radio-button value="all">
                  <el-icon><Lock /></el-icon>
                  所有对话
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <p class="setting-tip">端到端加密后，消息内容仅收发双方可以解读，服务端无法查看明文。开启加密后新建的对话生效，已有对话不会自动加密。</p>
            <el-form-item label="加密强度：">
              <el-tag type="success">AES-256-GCM</el-tag>
            </el-form-item>
          </div>
        </div>

        <!-- 外观 -->
        <div v-else-if="activeNav === 'appearance'" class="settings-section">
          <h3>{{ t('settings.title') }}</h3>
          <el-form-item :label="t('settings.theme') + '：'">
            <el-radio-group v-model="theme" @change="handleThemeChange">
              <el-radio-button value="dark">
                <el-icon><Moon /></el-icon>
                {{ t('settings.dark') }}
              </el-radio-button>
              <el-radio-button value="light">
                <el-icon><Sunny /></el-icon>
                {{ t('settings.light') }}
              </el-radio-button>
              <el-radio-button value="auto">
                <el-icon><Monitor /></el-icon>
                {{ t('settings.auto') }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item :label="t('settings.language') + '：'">
            <div class="language-selector">
              <el-select
                v-model="language"
                :placeholder="t('settings.selectLanguage')"
                @change="handleLanguageChange"
              >
                <el-option
                  v-for="lang in languages"
                  :key="lang.code"
                  :label="lang.flag + ' ' + lang.nativeName"
                  :value="lang.code"
                >
                  <span class="lang-option">
                    <span class="lang-flag">{{ lang.flag }}</span>
                    <span class="lang-name">{{ lang.nativeName }}</span>
                  </span>
                </el-option>
              </el-select>
              <div class="setting-tip">{{ t('settings.languageTip') }}</div>
            </div>
          </el-form-item>

          <el-form-item :label="t('settings.useSystemBrowser') + '：'">
            <div class="switch-with-tip">
              <el-switch v-model="useSystemBrowser" @change="handleUseSystemBrowserChange" />
              <div class="setting-tip">{{ t('settings.useSystemBrowserTip') }}</div>
            </div>
          </el-form-item>
        </div>

        <!-- 聊天 -->
        <div v-else-if="activeNav === 'friendChat'" class="settings-section">
          <h3>{{ t('settings.chatTitle') }}</h3>
          <el-form-item :label="t('settings.sendKey') + '：'">
            <el-radio-group v-model="sendKey" @change="handleSendKeyChange">
              <el-radio-button value="Enter">Enter</el-radio-button>
              <el-radio-button value="Ctrl+Enter">Ctrl + Enter</el-radio-button>
            </el-radio-group>
            <div class="setting-tip">{{ t('settings.sendKeyTip') }}</div>
          </el-form-item>
          <el-form-item :label="t('settings.friendListDensity') + '：'">
            <el-radio-group v-model="friendListDensity" @change="handleFriendListDensityChange">
              <el-radio-button value="compact">{{ t('settings.compact') }}</el-radio-button>
              <el-radio-button value="relaxed">{{ t('settings.relaxed') }}</el-radio-button>
            </el-radio-group>
            <div class="setting-tip">{{ t('settings.friendListDensityTip') }}</div>
          </el-form-item>
          <el-divider />
          <el-form-item :label="t('settings.cacheRetentionDays') + '：'">
            <el-select v-model="cacheRetentionDays" @change="handleCacheRetentionDaysChange" style="width: 180px">
              <el-option v-for="d in cacheDayOptions" :key="d" :label="t('settings.cacheDaysOption', { n: d })" :value="d" />
            </el-select>
            <div class="setting-tip">{{ t('settings.cacheRetentionDaysTip') }}</div>
          </el-form-item>
          <el-divider />
          <el-form-item :label="t('settings.unreadBadgeDisplay') + '：'">
            <div class="badge-settings-list">
              <div class="badge-setting-row">
                <div class="switch-with-label">
                  <el-switch v-model="showModeUnreadBadge" @change="handleShowModeUnreadBadgeChange" />
                  <span class="badge-label">{{ t('settings.showModeUnreadBadge') }}</span>
                </div>
                <div class="setting-tip-inline">{{ t('settings.showModeUnreadBadgeTip') }}</div>
              </div>
              <div class="badge-setting-row">
                <div class="switch-with-label">
                  <el-switch v-model="showTabUnreadBadge" @change="handleShowTabUnreadBadgeChange" />
                  <span class="badge-label">{{ t('settings.showTabUnreadBadge') }}</span>
                </div>
                <div class="setting-tip-inline">{{ t('settings.showTabUnreadBadgeTip') }}</div>
              </div>
                <div class="badge-setting-row">
                <div class="switch-with-label">
                  <el-switch v-model="showOnlineStatus" @change="handleShowOnlineStatusChange" />
                  <span class="badge-label">显示在线状态</span>
                </div>
                <div class="setting-tip-inline">在好友/群成员头像右下角显示在线(绿)或忙碌(橙)状态指示</div>
              </div>
            </div>
          </el-form-item>
          <el-divider />
          <h4>好友搜索</h4>
          <el-form-item :label="t('settings.enablePinyinSearch') + '：'">
            <div class="switch-with-tip">
              <el-switch v-model="enablePinyinSearch" @change="savePinyinSearchSetting" />
              <div class="setting-tip">{{ t('settings.enablePinyinSearchTip') }}</div>
            </div>
          </el-form-item>
        </div>

        <!-- AI 模型 -->
        <div v-else-if="activeNav === 'aiModel'" class="settings-section">
          <h3>{{ t('settings.aiModelTitle') }}</h3>
          <el-form-item :label="t('settings.aiMode') + '：'">
            <el-radio-group v-model="aiSettingsMode" @change="saveAiMode">
              <el-radio-button value="local">{{ t('settings.aiModeLocal') }}</el-radio-button>
              <el-radio-button value="cloud">{{ t('settings.aiModeCloud') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="上下文长度：">
            <el-slider v-model="contextTokens" :min="1000" :max="maxContextLimit" :step="1000" show-input @change="saveContextTokens" />
            <div class="setting-tip">对话上下文最大 token 数。当前模型上限 {{ maxContextLimit.toLocaleString() }}。越大则 AI 能记住越多历史。</div>
          </el-form-item>
          <el-divider />

          <div v-show="aiSettingsMode === 'local'">
            <h4>{{ t('settings.localModel') }}</h4>
            <el-form-item :label="t('settings.aiServerIP') + '：'">
              <el-input v-model="aiServerIP" :placeholder="t('settings.aiServerIPPlaceholder')" @blur="saveAiApiSettings" />
            </el-form-item>
            <el-form-item :label="t('settings.aiServerPort') + '：'">
              <el-input v-model="aiServerPort" :placeholder="t('settings.aiServerPortPlaceholder')" @blur="saveAiApiSettings" />
            </el-form-item>
            <div class="setting-tip">{{ t('settings.aiServerTip') }}</div>
          </div>

          <div v-show="aiSettingsMode === 'cloud'">
            <h4>{{ t('settings.cloudModel') }}</h4>
            <el-form-item :label="t('settings.cloudProvider') + '：'">
              <el-select v-model="cloudProviderId" placeholder="选择提供商" @change="handleProviderChange" style="width:100%">
                <el-option v-for="p in providerList" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('settings.cloudModelName') + '：'">
              <el-select v-if="cloudProviderId !== 'custom'" v-model="cloudModel" placeholder="选择模型" style="width:100%">
                <el-option v-for="m in currentProviderModels" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
              <el-input v-else v-model="cloudModel" placeholder="输入模型标识符" />
            </el-form-item>
            <el-form-item v-if="cloudProviderId === 'custom'" :label="t('settings.cloudApiBase') + '：'">
              <el-input v-model="cloudApiBase" placeholder="https://api.openai.com/v1" />
            </el-form-item>
            <el-form-item :label="t('settings.cloudApiKey') + '：'">
              <el-input v-model="cloudApiKey" type="password" placeholder="sk-..." show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveCloudApiSettings">{{ t('common.save') }}</el-button>
            </el-form-item>
            <div class="setting-tip">支持所有 OpenAI 兼容接口（DeepSeek、通义千问、智谱等）。选择提供商后自动填充地址和模型列表。</div>
          </div>
        </div>

        <!-- 图片引擎 -->
        <div v-else-if="activeNav === 'imageEngine'" class="settings-section">
          <h3>图片服务端</h3>
          <div class="setting-tip" style="margin-bottom:12px">自建图片生成服务（兼容 OpenAI Images API），适用于云端和本地部署的 Stable Diffusion / ComfyUI 等。配置后全局生效。</div>
          <el-form-item label="服务端 IP：">
            <el-input v-model="imageGenServerIP" placeholder="127.0.0.1" @blur="saveImageGenServerConfig" />
          </el-form-item>
          <el-form-item label="服务端端口：">
            <el-input v-model="imageGenServerPort" placeholder="7860" @blur="saveImageGenServerConfig" />
          </el-form-item>

          <el-divider />
          <h3>图片搜索</h3>
          <div class="setting-tip" style="margin-bottom:12px">内置爬虫（百度/必应）免 API Key，即开即用。可选配 Pixabay/Pexels/Unsplash API Key 作为补充。</div>
          <div class="img-provider-list">
            <div v-for="p in imgProviders" :key="p.id" class="img-provider-item">
              <div class="img-provider-header">
                <el-switch v-model="p.enabled" @change="saveImgProviders" size="small" />
                <span class="img-provider-name">{{ p.name }}</span>
                <el-tag v-if="p.builtin" size="small" type="success" effect="plain">{{ p.quota }}</el-tag>
                <el-tag v-else size="small" type="info" effect="plain">{{ p.quota }}</el-tag>
                <el-button v-if="p.id !== imgProviders[0].id" :icon="Top" size="small" text @click="moveProviderUp(p.id)" />
              </div>
              <div v-if="p.builtin && p.enabled" class="img-provider-builtin-hint">✅ 内置爬虫，无需 Key</div>
              <el-input v-if="!p.builtin && p.enabled" v-model="p.key" type="password" :placeholder="'输入 ' + p.name + ' API Key'" show-password size="small" @blur="saveImgProviders" class="img-provider-key" />
              <div class="img-provider-desc">{{ p.desc }}<el-link v-if="p.url" type="primary" :underline="false" style="margin-left:4px" @click="handleOpenLink(p.url)">注册</el-link></div>
            </div>
          </div>
          <el-divider />
          <h4>快速测试</h4>
          <div class="img-search-test-row">
            <el-select v-model="testProviderId" size="small" style="width:110px">
              <el-option v-for="p in imgProviders.filter(x => x.enabled)" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-input v-model="imgTestQuery" placeholder="输入关键词搜索图片" size="small" clearable @keyup.enter="quickImgSearch" style="flex:1" />
            <el-button size="small" @click="quickImgSearch" :loading="testingImgSearch" :icon="Search">搜索</el-button>
          </div>
          <div v-if="imgTestResult" :class="['img-test-result', imgTestResult.ok ? 'success' : 'error']" style="margin:6px 0">{{ imgTestResult.msg }}</div>
          <div v-if="imgTestResults.length > 0" class="img-test-grid">
            <div v-for="(img, i) in imgTestResults" :key="i" class="img-test-thumb" @click="handleOpenLink(img.original || img.url)">
              <img :src="img.url" :alt="img.alt" loading="lazy" @error="$event.target.style.display='none'" />
              <div class="img-test-thumb-label">{{ img.photographer }}</div>
            </div>
          </div>

          <el-divider />
          <h3>AI 图片生成</h3>
          <div class="setting-tip" style="margin-bottom:12px">调用 AI 模型生成图片。选择「自建服务端」时使用上方配置的图片服务端地址。</div>
          <el-form-item label="提供商：">
            <el-select v-model="imageGenProviderId" @change="handleImageGenProviderChange" style="width:100%">
              <el-option v-for="p in IMAGE_GEN_PROVIDERS" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="imageGenProviderId === 'custom'" label="接口地址：">
            <el-input v-model="imageGenEndpoint" placeholder="https://api.example.com/v1/images/generations" />
          </el-form-item>
          <el-form-item v-if="imageGenProviderId !== 'server'" label="API Key：">
            <el-input v-model="imageGenKey" type="password" placeholder="sk-..." show-password />
          </el-form-item>
          <el-form-item label="模型：">
            <el-input v-model="imageGenModel" :placeholder="imageGenDefaultModel || 'dall-e-3'" />
            <div class="setting-tip">默认自动填入提供商对应模型，可手动修改</div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveImageGenConfig">保存</el-button>
            <el-button style="margin-left:8px" @click="testImageGen" :loading="testingImageGen">测试生成</el-button>
          </el-form-item>
          <div v-if="testGenResult" :class="['img-test-result', testGenResult.success ? 'success' : 'error']" style="margin:4px 0">{{ testGenResult.msg }}</div>
          <div v-if="testGenImageData" class="img-test-grid" style="margin-top:4px">
            <div class="img-test-thumb" @click="handleOpenLink(testGenImageData)">
              <img :src="testGenImageData" alt="AI生成测试" loading="lazy" />
            </div>
          </div>

          <el-divider />
          <h4>图片获取策略</h4>
          <div class="setting-tip" style="margin-bottom:12px">应用于 PPT 课件生成时的图片获取方式。「联网搜索」从搜索引擎获取，「AI 生图」调用 AI 生成。一种方式失败时自动切换到另一种。</div>
          <el-radio-group v-model="imageGenPriority" @change="saveImageGenPriority">
            <el-radio-button value="search">联网搜索优先</el-radio-button>
            <el-radio-button value="generate">AI 生图优先</el-radio-button>
          </el-radio-group>
          <div v-if="imageGenPriority === 'generate'" style="margin-top:12px">
            <div class="setting-tip" style="margin-bottom:8px">AI 生图时的子优先级：</div>
            <el-radio-group v-model="imageGenSubPriority" @change="saveImageGenSubPriority">
              <el-radio-button value="server">图片服务端优先</el-radio-button>
              <el-radio-button value="search">搜索获取优先</el-radio-button>
            </el-radio-group>
            <div class="setting-tip" style="margin-top:6px">
              <template v-if="imageGenSubPriority === 'server'">先尝试上方配置的「图片服务端」(IP:端口)，失败则尝试选择的生图提供商，最后回退到联网搜索。</template>
              <template v-else>按当前选择的生图提供商进行 AI 生成，失败时回退到联网搜索。</template>
            </div>
          </div>
          <div v-if="imageGenPriority === 'generate' && !hasImageGenKey" class="setting-tip" style="color:var(--el-color-warning);margin-top:6px">⚠️ 当前未配置 AI 图片生成，请在本页「AI 图片生成」中填写配置</div>
        </div>

        <!-- 课件与文件 -->
        <div v-else-if="activeNav === 'courseware'" class="settings-section">
          <h3>PPT 课件输出目录</h3>
          <el-form-item label="输出目录：">
            <div class="download-dir-row">
              <el-input v-model="pptDir" placeholder="选择PPT课件的保存路径" @blur="savePPTDir" />
              <el-button @click="selectPPTDir" :icon="FolderOpened" />
            </div>
            <div class="setting-tip">AI 生成的课件（.pptx 文件）将保存到此目录。留空则使用下载目录。</div>
          </el-form-item>
          <el-divider />
          <h3>{{ t('settings.downloadTitle') }}</h3>
          <el-form-item :label="t('settings.downloadDir') + '：'">
            <div class="download-dir-row">
              <el-input
                v-model="downloadDir"
                :placeholder="t('settings.downloadDirPlaceholder')"
                @blur="handleDownloadDirBlur"
                @keyup.enter="handleDownloadDirEnter"
              />
              <el-button @click="handleSelectDir" :icon="FolderOpened" />
            </div>
            <div class="setting-tip">{{ t('settings.downloadDirTip') }}</div>
          </el-form-item>
          <el-divider />
          <h3>课件模板</h3>
          <el-form-item label="当前模板：">
            <el-select v-model="activeTemplate" @change="applyTemplate" style="width:100%">
              <el-option v-for="t in templateList" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </el-form-item>
          <div class="template-actions">
            <el-button @click="showAddTemplate = true" :icon="Plus">新建模板</el-button>
          </div>

          <el-dialog v-model="showAddTemplate" title="新建模板" width="360px" :append-to-body="false">
            <el-form label-width="70px" class="template-dialog-form">
              <el-form-item label="名称"><el-input v-model="newTemplateName" /></el-form-item>
              <el-form-item label="主题色"><el-input v-model="newTemplateColor" placeholder="#4A9EFF" /></el-form-item>
              <el-form-item label="字体"><el-input v-model="newTemplateFont" placeholder="Microsoft YaHei" /></el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="showAddTemplate = false">取消</el-button>
              <el-button type="primary" @click="saveTemplate">保存</el-button>
            </template>
          </el-dialog>
        </div>

        <!-- 服务器 -->
        <div v-else-if="activeNav === 'server'" class="settings-section">
          <h3>公网服务器（认证源 + 日常聊天）</h3>
          <div class="setting-tip">所有用户在此注册登录，也是验证 LAN 服务器身份的认证源。</div>
          <el-form-item label="公网服务器 URL：">
            <el-input
              v-model="primaryServerUrl"
              placeholder="http://your-public-server.com:3000"
              @blur="savePrimaryServerSetting"
            />
          </el-form-item>

          <el-divider />

          <h3>{{ t('settings.serverTitle') }}（内网 LAN 服务器 - 可选）</h3>
          <div class="setting-tip">配置后可同时连接内网服务器，与公网联系人共存互不干扰。</div>
          <el-form-item :label="t('settings.serverIP') + '：'">
            <el-input
              v-model="serverIP"
              :placeholder="t('settings.serverIPPlaceholder')"
              @blur="saveServerSettings"
            />
            <div class="setting-tip">{{ t('settings.serverIPTip') }}</div>
          </el-form-item>
          <el-form-item :label="t('settings.serverPort') + '：'">
            <el-input
              v-model="serverPort"
              :placeholder="t('settings.serverPortPlaceholder')"
              @blur="saveServerSettings"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="testServerConnection" :loading="testingServer">
              {{ testingServer ? t('settings.testing') : t('settings.testConnection') }}
            </el-button>
          </el-form-item>
        </div>

        <!-- 关于 -->
        <div v-else-if="activeNav === 'about'" class="settings-section">
          <h3>{{ t('settings.checkUpdate') }}</h3>
          <div class="update-section">
            <div class="about-row">
              <span class="about-label">{{ t('settings.currentVersion') }}</span>
              <span class="about-value">v{{ appVersion }}</span>
            </div>
            <div class="update-actions">
              <template v-if="updateStatus === 'idle' || updateStatus === 'error' || updateStatus === 'checking'">
                <el-button type="primary" @click="handleCheckUpdate" :loading="updateStatus === 'checking'">
                  {{ updateStatus === 'checking' ? t('settings.checking') : t('settings.checkUpdateBtn') }}
                </el-button>
              </template>
              <template v-else-if="updateStatus === 'available'">
                <el-button type="success" @click="handleDownloadUpdate">
                  下载更新 v{{ updateVersion }}
                </el-button>
              </template>
              <template v-else-if="updateStatus === 'downloading'">
                <el-button type="warning" disabled>
                  下载中 {{ updateProgress }}%
                </el-button>
              </template>
              <template v-else-if="updateStatus === 'downloaded'">
                <el-button type="danger" @click="handleInstallUpdate">
                  立即安装并重启
                </el-button>
              </template>
            </div>

            <!-- 下载进度条 -->
            <div v-if="updateStatus === 'downloading'" class="update-progress-section">
              <el-progress
                :percentage="updateProgress"
                :stroke-width="12"
                :text-inside="true"
                striped
                striped-flow
                :duration="6"
                status="success"
              />
              <div class="update-speed">{{ updateSpeed }}</div>
            </div>

            <div v-if="updateMessage" class="update-message" :class="updateMessageType">{{ updateMessage }}</div>
          </div>
          <el-divider />
          <h3>{{ t('settings.about') }}</h3>
          <div class="about-info-list">
            <div class="about-row">
              <span class="about-label">{{ t('app.projectName') }}</span>
              <span class="about-value">Electronic</span>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.version') }}</span>
              <span class="about-value">v{{ appVersion }}</span>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.author') }}</span>
              <span class="about-value">FireOut</span>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.github') }}</span>
              <el-link type="primary" :underline="false" @click="handleOpenLink('https://github.com/12yierye/Electronic-Client')">Electronic-Client</el-link>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.website') }}</span>
              <el-link type="primary" :underline="false" @click="handleOpenLink('https://electronic-app.com')">Electronic.com</el-link>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.reportIssue') }}</span>
              <el-link type="primary" :underline="false" @click="handleReportIssue">GitHub Issues</el-link>
            </div>
            <div class="about-row">
              <span class="about-label">调试模式</span>
              <el-switch v-model="settingsStore.debugMode" @change="handleDebugModeChange" size="small" />
            </div>
          </div>
        </div>

        <!-- 调试中心 -->
        <div v-else-if="activeNav === 'debug'" class="settings-section">
          <h3>调试中心</h3>
          <div class="debug-section">
            <div class="debug-desc">使用正式链路生成随机主题的PPT课件，验证图片搜索、内容类型等功能。生成的PPT带"调试"标记，不会出现在内容库中。</div>
            <el-form-item label="页数：">
              <el-input-number v-model="debugSlideCount" :min="3" :max="20" />
            </el-form-item>
            <el-form-item label="主题：">
              <div class="debug-topic-row">
                <el-input v-model="debugTopic" placeholder="随机生成" disabled />
                <el-button size="small" @click="randomizeTopic">换一个</el-button>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="warning" @click="handleDebugGenerate" :loading="debugGenerating" :icon="Monitor">
                {{ debugGenerating ? '生成中...' : 'AI生成随机PPT' }}
              </el-button>
            </el-form-item>
            <div v-if="debugProgress" class="debug-progress">{{ debugProgress }}</div>
            <div v-if="debugResult" :class="['debug-result', debugResult.success ? 'success' : 'error']">
              <div class="debug-result-title">{{ debugResult.success ? '✅ 生成成功' : '❌ 生成失败' }}</div>
              <div class="debug-result-msg">{{ debugResult.message }}</div>
              <div v-if="debugResult.slideCount" class="debug-result-meta">幻灯片数: {{ debugResult.slideCount }} | 文件名: {{ debugResult.fileName }}</div>
            </div>
            <el-divider />
            <div class="debug-history-header">
              <h4>历史调试记录</h4>
              <el-button size="small" text :icon="RefreshRight" @click="loadDebugFiles" :loading="loadingDebugFiles">刷新</el-button>
            </div>
            <div v-if="loadingDebugFiles" class="debug-progress">加载中...</div>
            <div v-else-if="debugFiles.length === 0" class="debug-empty">暂无调试记录</div>
            <div v-else class="debug-file-list">
              <div v-for="f in debugFiles" :key="f.metaPath" class="debug-file-item" @click="openDebugFile(f.pptxPath)">
                <div class="debug-file-icon"><el-icon :size="32"><Files /></el-icon></div>
                <div class="debug-file-info">
                  <div class="debug-file-name">{{ f.topic }}</div>
                  <div class="debug-file-meta">{{ f.slideCount }} 页 · {{ formatDebugSize(f.pptxSize) }} · {{ formatDebugDate(f.createdAt) }}</div>
                </div>
                <el-button size="small" text type="danger" :icon="Delete" @click.stop="deleteDebugFile(f)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Moon, Sunny, Monitor, FolderOpened, Files, User, Setting, MagicStick, Link, Search, Picture, Folder, InfoFilled, Message, RefreshRight, Lock, View, Hide, Delete, PictureFilled } from '@element-plus/icons-vue'
import { useSettingsStore } from '../../stores/settings'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'
import { languages } from '../../utils/i18n'
import UserProfile from './settings/UserProfile.vue'
import pkg from '../../../package.json'

const settingsStore = useSettingsStore()
const aiStore = useAIStore()
const { t, setLocale } = useI18n()

const appVersion = pkg.version

const activeNav = ref('profile')

const navItems = computed(() => {
  const items = [
    { key: 'profile', label: '用户', icon: User },
    { key: 'appearance', label: '外观', icon: Setting },
    { key: 'friendChat', label: '聊天', icon: Message },
    { key: 'aiModel', label: 'AI 模型', icon: MagicStick },
    { key: 'imageEngine', label: '图片引擎', icon: Picture },
    { key: 'courseware', label: '课件与文件', icon: Folder },
    { key: 'server', label: '服务器', icon: Link },
    { key: 'about', label: '关于', icon: InfoFilled },
  ]
  if (settingsStore.debugMode) {
    items.push({ key: 'debug', label: '调试中心', icon: Monitor })
  }
  return items
})

const theme = ref('dark')
const language = ref('zh-CN')
const serverIP = ref('127.0.0.1')
const serverPort = ref('3000')
const primaryServerUrl = ref('')
const testingServer = ref(false)
const enablePinyinSearch = ref(false)
const useSystemBrowser = ref(false)
const sendKey = ref('Enter')
const e2eEncryption = ref('off')
const friendListDensity = ref('compact')
const navFlashIntensity = ref('medium')
const cacheRetentionDays = ref(30)
const cacheDayOptions = [7, 14, 30, 60, 90, 180]
const showModeUnreadBadge = ref(true)
const showTabUnreadBadge = ref(true)
const showOnlineStatus = ref(true)
// 自动更新状态
const checkingUpdate = ref(false)
const updateMessage = ref('')
const updateMessageType = ref('')
const updateVersion = ref('')
const updateProgress = ref(0)
const updateSpeed = ref('')
const updateStatus = ref('idle') // idle | checking | available | downloading | downloaded | error
const canInstall = ref(false)

// 调试中心
const debugSlideCount = ref(10)
const debugTopic = ref('')
const debugGenerating = ref(false)
const debugProgress = ref('')
const debugResult = ref(null)
const debugFiles = ref([])
const loadingDebugFiles = ref(false)
const debugTopics = ['人工智能','环境保护','太阳能发电','Python编程','大数据分析','云计算','机器学习','区块链技术','量子计算','生物多样性','数据结构','计算机网络','操作系统','数据库原理','软件工程']

function formatDebugSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
function formatDebugDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
async function loadDebugFiles() {
  if (!window.electronAPI?.getPPTDir || !window.electronAPI?.scanDebugDirectory) return
  loadingDebugFiles.value = true
  try {
    const dirRes = await window.electronAPI.getPPTDir()
    if (dirRes.success && dirRes.dir) {
      const result = await window.electronAPI.scanDebugDirectory(dirRes.dir)
      if (result.success) debugFiles.value = result.files || []
    }
  } catch {} finally {
    loadingDebugFiles.value = false
  }
}
function openDebugFile(path) {
  if (path && window.electronAPI?.openFilePath) {
    window.electronAPI.openFilePath(path)
  }
}
async function deleteDebugFile(f) {
  if (!window.electronAPI?.deletePPTFile) return
  await window.electronAPI.deletePPTFile({ pptxPath: f.pptxPath, metaPath: f.metaPath })
  debugFiles.value = debugFiles.value.filter(x => x.metaPath !== f.metaPath)
}
function randomizeTopic() {
  debugTopic.value = debugTopics[Math.floor(Math.random() * debugTopics.length)]
}
randomizeTopic()
const handleDebugModeChange = () => {
  if (!settingsStore.debugMode && activeNav.value === 'debug') {
    activeNav.value = 'about'
  }
}
const handleDebugGenerate = async () => {
  const topic = debugTopic.value
  const count = debugSlideCount.value
  debugGenerating.value = true
  debugProgress.value = '正在请求AI生成课件大纲...'
  debugResult.value = null
  try {
    if (window.electronAPI?.onDebugProgress) {
      window.electronAPI.onDebugProgress((data) => {
        if (data.step === 'planning') debugProgress.value = '📐 正在设计课件结构...'
        else if (data.step === 'building') debugProgress.value = '📊 正在生成' + (data.slideCount || '') + '张幻灯片...'
        else if (data.step === 'image_search') debugProgress.value = '🔍 ' + (data.message || '搜索图片...')
        else if (data.step === 'image_found') debugProgress.value = '📷 ' + (data.message || '图片已嵌入')
        else if (data.step === 'image_fallback') debugProgress.value = '⚠️ ' + (data.message || '图片搜索无结果')
        else if (data.step === 'saving') debugProgress.value = '💾 正在保存课件文件...'
        else if (data.message) debugProgress.value = data.message
      })
    }
    const cloudRaw = localStorage.getItem('cloudApiSettings')
    let cloudConfig = {}
    if (cloudRaw) { try { const c = JSON.parse(cloudRaw); cloudConfig = { base: c.base, key: c.key, model: c.model, provider: c.provider } } catch {} }
    const result = await window.electronAPI.debugGeneratePPTX({
      topic, slideCount: count, language: settingsStore.language || 'zh-CN'
    })
    if (result.success) {
      debugResult.value = { success: true, message: result.message, slideCount: result.slideCount, fileName: result.fileName }
      debugProgress.value = ''
      loadDebugFiles()
    } else {
      debugResult.value = { success: false, message: result.message || '未知错误' }
      debugProgress.value = ''
    }
  } catch (e) {
    debugResult.value = { success: false, message: e.message }
    debugProgress.value = ''
  } finally {
    debugGenerating.value = false
    if (window.electronAPI?.removeDebugListeners) {
      window.electronAPI.removeDebugListeners()
    }
  }
}

const AI_SETTINGS_KEY = 'aiApiSettings'

const aiServerIP = ref('127.0.0.1')
const aiServerPort = ref('1234')

const aiSettingsMode = ref('local')

const cloudProviderId = ref('')
const cloudApiBase = ref('https://api.openai.com/v1')
const cloudApiKey = ref('')
const cloudModel = ref('gpt-4o')
const keyVisible = ref(false)
const testingCloud = ref(false)
const pptDir = ref('')
const contextTokens = ref(32000)
const testingImgSearch = ref(false)
const imgTestResult = ref(null)
const imgTestQuery = ref('')
const imgTestResults = ref([])
const testProviderId = ref('baidu')
const imageGenProviderId = ref('openai')
const imageGenEndpoint = ref('')
const imageGenKey = ref('')
const imageGenModel = ref('')
const imageGenServerIP = ref('127.0.0.1')
const imageGenServerPort = ref('7860')
const testingImageGen = ref(false)
const testGenResult = ref(null)
const testGenImageData = ref(null)
const imageGenPriority = ref('search')
const imageGenSubPriority = ref('search')
const imgProviders = ref([
  { id: 'baidu', name: '百度图片', builtin: true, enabled: true, key: '', quota: '免 API', desc: '内置爬虫，无需配置，中文搜索效果最佳', url: '' },
  { id: 'bing', name: '必应图片', builtin: true, enabled: true, key: '', quota: '免 API', desc: '内置爬虫，无需配置，通用搜索', url: '' },
  { id: 'pixabay', name: 'Pixabay', builtin: false, enabled: false, key: '', quota: '5000次/时', desc: '免费图库，可选配 Key 提升质量', url: 'https://pixabay.com/api/docs/' },
  { id: 'pexels', name: 'Pexels', builtin: false, enabled: false, key: '', quota: '200次/时', desc: '高质量摄影图片，可选配 Key', url: 'https://www.pexels.com/api/' },
  { id: 'unsplash', name: 'Unsplash', builtin: false, enabled: false, key: '', quota: '50次/时', desc: '精美创意图片，可选配 Key', url: 'https://unsplash.com/developers' }
])
const activeTemplate = ref('blue')
const templateList = ref([])
const showAddTemplate = ref(false)
const newTemplateName = ref('')
const newTemplateColor = ref('')
const newTemplateFont = ref('Microsoft YaHei')

const maxContextLimit = computed(() => {
  const p = PROVIDERS.find(p => p.id === cloudProviderId.value)
  if (p && p.models.length > 0) {
    const m = cloudModel.value ? p.models.find(m => m.id === cloudModel.value) : p.models[0]
    if (m?.contextLimit) return m.contextLimit
  }
  return 100000
})

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', thinking: 'optional', contextLimit: 1000000 }, { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', thinking: 'always', contextLimit: 1000000 }] },
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', models: [{ id: 'gpt-4o', name: 'GPT-4o', thinking: 'none' }, { id: 'gpt-4o-mini', name: 'GPT-4o Mini', thinking: 'none' }, { id: 'o3-mini', name: 'o3-mini', thinking: 'optional' }, { id: 'o1', name: 'o1', thinking: 'always' }] },
  { id: 'qwen', name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: [{ id: 'qwen-plus', name: 'Qwen Plus', thinking: 'none' }, { id: 'qwen-max', name: 'Qwen Max', thinking: 'optional' }, { id: 'qwen-turbo', name: 'Qwen Turbo', thinking: 'none' }, { id: 'qwen-long', name: 'Qwen Long', thinking: 'none' }] },
  { id: 'zhipu', name: '智谱AI', baseURL: 'https://open.bigmodel.cn/api/paas/v4', models: [{ id: 'glm-4-flash', name: 'GLM-4 Flash', thinking: 'none' }, { id: 'glm-4', name: 'GLM-4', thinking: 'optional' }, { id: 'glm-4-plus', name: 'GLM-4 Plus', thinking: 'optional' }] },
  { id: 'moonshot', name: 'Moonshot', baseURL: 'https://api.moonshot.cn/v1', models: [{ id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', thinking: 'none' }, { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', thinking: 'none' }, { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', thinking: 'none' }] },
  { id: 'custom', name: '自定义', baseURL: '', models: [] }
]

const providerList = PROVIDERS

const IMAGE_GEN_PROVIDERS = [
  { id: 'openai', name: 'OpenAI (DALL-E)', baseURL: 'https://api.openai.com/v1/images/generations', defaultModel: 'dall-e-3' },
  { id: 'qwen', name: '通义万相', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations', defaultModel: 'wanx2.1-t2i-turbo' },
  { id: 'zhipu', name: '智谱 CogView', baseURL: 'https://open.bigmodel.cn/api/paas/v4/images/generations', defaultModel: 'cogview-3-plus' },
  { id: 'server', name: '自建服务端 (IP:端口)', baseURL: '', defaultModel: '' },
  { id: 'custom', name: '自定义', baseURL: '', defaultModel: '' }
]

const currentProviderModels = computed(() => {
  const p = PROVIDERS.find(p => p.id === cloudProviderId.value)
  return p ? p.models : []
})

const imageGenDefaultModel = computed(() => {
  const p = IMAGE_GEN_PROVIDERS.find(p => p.id === imageGenProviderId.value)
  return p ? p.defaultModel : ''
})
const hasImageGenKey = computed(() => !!imageGenKey.value || imageGenProviderId.value === 'server' || imageGenSubPriority.value === 'server')

const CLOUD_API_KEY = 'cloudApiSettings'

const SERVER_SETTINGS_KEY = 'lanChatSettings'
function getCurrentUsername() {
    try {
        const user = localStorage.getItem('userInfo')
        return user ? JSON.parse(user).username : ''
    } catch {
        return ''
    }
}

function getDownloadDirKey() {
    const username = getCurrentUsername()
    return username ? `downloadDir_${username}` : 'downloadDir'
}

const downloadDir = ref('')

const saveDownloadDir = () => {
    const dir = downloadDir.value.trim()
    const key = getDownloadDirKey()
    localStorage.setItem(key, dir)
    if (window.electronAPI?.setDownloadDir) {
        window.electronAPI.setDownloadDir(dir || null)
    }
}

const handleDownloadDirBlur = () => {
    const dir = downloadDir.value.trim()
    if (!dir) return
    if (window.electronAPI?.ensureDir) {
        window.electronAPI.ensureDir(dir)
    }
    saveDownloadDir()
}

const handleDownloadDirEnter = () => {
    handleDownloadDirBlur()
}

const handleSelectDir = async () => {
    if (!window.electronAPI?.selectDirectory) return
    const result = await window.electronAPI.selectDirectory()
    if (result.success && result.dir) {
        downloadDir.value = result.dir
        saveDownloadDir()
    }
}

const saveAiApiSettings = () => {
    const ip = aiServerIP.value || '127.0.0.1'
    const port = aiServerPort.value || '1234'
    const apiUrl = `http://${ip}:${port}/v1`
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({ ip, port }))
    if (window.electronAPI?.setAiApiUrl) {
        window.electronAPI.setAiApiUrl(apiUrl)
    }
}

const saveCloudApiSettings = () => {
    const data = { base: cloudApiBase.value, model: cloudModel.value, provider: cloudProviderId.value, key: cloudApiKey.value }
    localStorage.setItem(CLOUD_API_KEY, JSON.stringify(data))
    if (window.electronAPI?.setCloudApiBase) {
        window.electronAPI.setCloudApiBase(cloudApiBase.value)
    }
    if (window.electronAPI?.setCloudApiKey) {
        window.electronAPI.setCloudApiKey(cloudApiKey.value)
    }
    if (window.electronAPI?.setCloudModel) {
        window.electronAPI.setCloudModel(cloudModel.value)
    }
    if (window.electronAPI?.setCloudProvider) {
        window.electronAPI.setCloudProvider(cloudProviderId.value)
    }
}

const handleImageGenProviderChange = (providerId) => {
  const p = IMAGE_GEN_PROVIDERS.find(x => x.id === providerId)
  if (p) {
    if (p.baseURL) imageGenEndpoint.value = p.baseURL
    else if (providerId === 'server') imageGenEndpoint.value = ''
    imageGenModel.value = p.defaultModel || ''
  }
  if (providerId === 'server') {
    saveImageGenServerConfig()
  }
}
const saveImageGenConfig = async () => {
  if (imageGenProviderId.value === 'server') {
    await saveImageGenServerConfig()
    return
  }
  const config = { provider: imageGenProviderId.value, endpoint: imageGenEndpoint.value, key: imageGenKey.value, model: imageGenModel.value }
  localStorage.setItem('imageGenConfig', JSON.stringify(config))
  if (window.electronAPI?.setImageGenConfig) { await window.electronAPI.setImageGenConfig(config) }
  ElMessage.success('已保存')
}
const saveImageGenServerConfig = async () => {
  localStorage.setItem('imageGenServerIP', imageGenServerIP.value)
  localStorage.setItem('imageGenServerPort', imageGenServerPort.value)
  if (window.electronAPI?.setImageGenServer) {
    const res = await window.electronAPI.setImageGenServer({ ip: imageGenServerIP.value, port: imageGenServerPort.value })
    if (res.success) {
      ElMessage.success(`已保存 — 服务端地址: ${res.serverURL}`)
    }
  }
  // Also save a minimal config for the provider identity
  const config = { provider: 'server', model: imageGenModel.value }
  localStorage.setItem('imageGenConfig', JSON.stringify(config))
  if (window.electronAPI?.setImageGenConfig) { await window.electronAPI.setImageGenConfig(config) }
}
const testImageGen = async () => {
  if (imageGenProviderId.value !== 'server' && imageGenSubPriority.value !== 'server' && !imageGenKey.value) { ElMessage.warning('请先填写 API Key 或配置图片服务端'); return }
  testingImageGen.value = true
  testGenResult.value = null
  testGenImageData.value = null
  try {
    if (window.electronAPI?.testImageGen) {
      const res = await window.electronAPI.testImageGen('一张关于科技的抽象插画，数字艺术风格')
      if (res.success && res.data) { testGenImageData.value = res.data; testGenResult.value = { success: true, msg: '✅ 生成成功' } }
      else { testGenResult.value = { success: false, msg: res.error || '生成失败' } }
    }
  } catch (e) { testGenResult.value = { success: false, msg: e.message } }
  finally { testingImageGen.value = false }
}
const saveImageGenPriority = async () => {
  localStorage.setItem('imageGenPriority', imageGenPriority.value)
  if (window.electronAPI?.setImageGenPriority) { await window.electronAPI.setImageGenPriority(imageGenPriority.value) }
}
const saveImageGenSubPriority = async () => {
  localStorage.setItem('imageGenSubPriority', imageGenSubPriority.value)
  if (window.electronAPI?.setImageGenSubPriority) { await window.electronAPI.setImageGenSubPriority(imageGenSubPriority.value) }
}
const loadImageGenConfig = async () => {
  const saved = localStorage.getItem('imageGenConfig')
  if (saved) {
    try { const c = JSON.parse(saved); imageGenProviderId.value = c.provider || 'openai'; imageGenEndpoint.value = c.endpoint || ''; imageGenKey.value = c.key || ''; imageGenModel.value = c.model || '' } catch {}
  }
  const savedPriority = localStorage.getItem('imageGenPriority')
  if (savedPriority) imageGenPriority.value = savedPriority
  const savedSubPriority = localStorage.getItem('imageGenSubPriority')
  if (savedSubPriority) imageGenSubPriority.value = savedSubPriority
  if (window.electronAPI?.getImageGenConfig) {
    const res = await window.electronAPI.getImageGenConfig()
    if (res.success && res.config) { const c = res.config; if (c.provider) imageGenProviderId.value = c.provider; if (c.endpoint) imageGenEndpoint.value = c.endpoint; if (c.key) imageGenKey.value = c.key; if (c.model) imageGenModel.value = c.model }
  }
  if (window.electronAPI?.getImageGenPriority) {
    const res = await window.electronAPI.getImageGenPriority()
    if (res.success) imageGenPriority.value = res.value
  }
  if (window.electronAPI?.getImageGenSubPriority) {
    const res = await window.electronAPI.getImageGenSubPriority()
    if (res.success) imageGenSubPriority.value = res.value
  }
  // Load server config
  const savedIP = localStorage.getItem('imageGenServerIP')
  if (savedIP) imageGenServerIP.value = savedIP
  const savedPort = localStorage.getItem('imageGenServerPort')
  if (savedPort) imageGenServerPort.value = savedPort
  if (window.electronAPI?.getImageGenServer) {
    const res = await window.electronAPI.getImageGenServer()
    if (res.success) {
      if (res.ip) imageGenServerIP.value = res.ip
      if (res.port) imageGenServerPort.value = res.port
    }
  }
}

const handleProviderChange = (providerId) => {
    const p = PROVIDERS.find(p => p.id === providerId)
    if (p) {
        if (p.baseURL) {
            cloudApiBase.value = p.baseURL
        }
        if (p.models.length > 0) {
            cloudModel.value = p.models[0].id
        }
        cloudProviderId.value = providerId
    }
}

const saveImgProviders = () => {
  const config = {}
  for (const p of imgProviders.value) { config[p.id] = { enabled: p.enabled, key: p.key, builtin: p.builtin } }
  config._priority = imgProviders.value.map(p => p.id)
  localStorage.setItem('imageProviderConfig', JSON.stringify(config))
  if (window.electronAPI?.setImageProviderConfig) { window.electronAPI.setImageProviderConfig(config) }
  const firstEnabled = imgProviders.value.find(p => p.enabled)
  if (firstEnabled) testProviderId.value = firstEnabled.id
}
const loadImgProviders = async () => {
  const saved = localStorage.getItem('imageProviderConfig')
  if (saved) {
    try {
      const config = JSON.parse(saved)
      for (const p of imgProviders.value) { const c = config[p.id]; if (c) { p.enabled = c.enabled; p.key = c.key || '' } }
      if (config._priority) { const ordered = []; for (const id of config._priority) { const p = imgProviders.value.find(x => x.id === id); if (p) ordered.push(p) }; for (const p of imgProviders.value) { if (!ordered.includes(p)) ordered.push(p) }; imgProviders.value = ordered }
      if (window.electronAPI?.setImageProviderConfig) { window.electronAPI.setImageProviderConfig(config) }
    } catch {}
  } else if (window.electronAPI?.getImageProviderConfig) {
    const result = await window.electronAPI.getImageProviderConfig()
    if (result.success && result.config) { const config = result.config; for (const p of imgProviders.value) { const c = config[p.id]; if (c) { p.enabled = c.enabled; p.key = c.key || '' } } }
  }
  const firstEnabled = imgProviders.value.find(p => p.enabled)
  if (firstEnabled) testProviderId.value = firstEnabled.id
}
const moveProviderUp = (id) => {
  const idx = imgProviders.value.findIndex(p => p.id === id)
  if (idx <= 0) return
  const arr = imgProviders.value; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  imgProviders.value = [...arr]
  saveImgProviders()
}
const quickImgSearch = async () => {
  const query = imgTestQuery.value.trim()
  if (!query) return
  testingImgSearch.value = true
  imgTestResult.value = null; imgTestResults.value = []
  try {
    const provider = testProviderId.value
    const p = imgProviders.value.find(x => x.id === provider)
    if (!p?.enabled) { imgTestResult.value = { ok: false, msg: '请先启用 ' + p?.name }; return }
    if (!p.builtin && !p?.key) { imgTestResult.value = { ok: false, msg: '请填写 ' + p?.name + ' 的 API Key' }; return }
    saveImgProviders()
    const res = await window.electronAPI.testImageSearch(query, provider)
    if (res?.success && res.count > 0) { imgTestResults.value = res.images || []; imgTestResult.value = { ok: true, msg: '✅ ' + p.name + ' ' + res.count + '张 ' + res.time + 'ms' } }
    else if (res?.success) { imgTestResult.value = { ok: false, msg: '⚠️ 未找到匹配图片' } }
    else { imgTestResult.value = { ok: false, msg: '❌ ' + (res?.message || '失败') } }
  } catch (e) { imgTestResult.value = { ok: false, msg: '❌ ' + e.message } }
  finally { testingImgSearch.value = false }
}

const saveAiMode = () => {
    localStorage.setItem('aiMode', aiSettingsMode.value)
}

const testCloudApi = async () => {
    if (!cloudApiKey.value) return
    testingCloud.value = true
    try {
        const result = window.electronAPI.testCloudApi
            ? await window.electronAPI.testCloudApi({ base: cloudApiBase.value, key: cloudApiKey.value, model: cloudModel.value })
            : { success: false, message: '功能不可用' }
        if (result.success) {
            ElMessage.success(result.message)
        } else {
            ElMessage.error(result.message)
        }
    } catch (e) {
        ElMessage.error('测试失败：' + e.message)
    }
    testingCloud.value = false
}

const savePPTDir = () => {
    const dir = pptDir.value.trim()
    localStorage.setItem('pptDir', dir)
    if (window.electronAPI?.setPPTDir) {
        window.electronAPI.setPPTDir(dir || null)
    }
}

const selectPPTDir = async () => {
    if (!window.electronAPI?.selectDirectory) return
    const result = await window.electronAPI.selectDirectory()
    if (result.success && result.dir) {
        pptDir.value = result.dir
        savePPTDir()
    }
}

const saveContextTokens = () => {
    if (contextTokens.value > maxContextLimit.value) {
        contextTokens.value = maxContextLimit.value
    }
    localStorage.setItem('aiContextTokens', contextTokens.value)
    if (aiStore) aiStore.setContextTokens(contextTokens.value)
}

const loadTemplates = () => {
    try {
        templateList.value = JSON.parse(localStorage.getItem('ai_templates') || '[]')
        if (templateList.value.length === 0) {
            templateList.value = [
                { id: 'blue', name: '蓝色学术', color: '#4A9EFF', font: 'Microsoft YaHei' },
                { id: 'academic', name: '简约学术', color: '#2980B9', font: 'SimSun' },
                { id: 'warm', name: '暖色教学', color: '#E67E22', font: 'Microsoft YaHei' }
            ]
            localStorage.setItem('ai_templates', JSON.stringify(templateList.value))
        }
        activeTemplate.value = localStorage.getItem('ai_active_template') || 'blue'
    } catch {}
}

const applyTemplate = (id) => {
    localStorage.setItem('ai_active_template', id)
}

const saveTemplate = () => {
    if (!newTemplateName.value.trim()) return
    templateList.value.push({
        id: 'tpl_' + Date.now(),
        name: newTemplateName.value.trim(),
        color: newTemplateColor.value || '#4A9EFF',
        font: newTemplateFont.value || 'Microsoft YaHei'
    })
    localStorage.setItem('ai_templates', JSON.stringify(templateList.value))
    showAddTemplate.value = false
    newTemplateName.value = ''
    newTemplateColor.value = ''
    newTemplateFont.value = 'Microsoft YaHei'
}

onMounted(() => {
    theme.value = settingsStore.theme
    language.value = settingsStore.language || 'zh-CN'
    useSystemBrowser.value = settingsStore.useSystemBrowser
    if (window.electronAPI?.getUseSystemBrowser) { window.electronAPI.getUseSystemBrowser().then(r => { if (r.success) useSystemBrowser.value = r.value }) }
    if (window.electronAPI?.setUseSystemBrowser) { window.electronAPI.setUseSystemBrowser(useSystemBrowser.value) }
    sendKey.value = settingsStore.sendKey || 'Enter'
    friendListDensity.value = settingsStore.friendListDensity || 'compact'
    navFlashIntensity.value = settingsStore.navFlashIntensity || 'medium'
    cacheRetentionDays.value = settingsStore.cacheRetentionDays || 30
    showModeUnreadBadge.value = settingsStore.showModeUnreadBadge !== undefined ? settingsStore.showModeUnreadBadge : true
    showTabUnreadBadge.value = settingsStore.showTabUnreadBadge !== undefined ? settingsStore.showTabUnreadBadge : true
    showOnlineStatus.value = settingsStore.showOnlineStatus !== undefined ? settingsStore.showOnlineStatus : true

    const aiSettings = localStorage.getItem(AI_SETTINGS_KEY)
    if (aiSettings) {
        const s = JSON.parse(aiSettings)
        aiServerIP.value = s.ip || '127.0.0.1'
        aiServerPort.value = s.port || '1234'
    }
    saveAiApiSettings()

    const cloudRaw = localStorage.getItem(CLOUD_API_KEY)
    if (cloudRaw) {
        const s = JSON.parse(cloudRaw)
        cloudApiBase.value = s.base || 'https://api.openai.com/v1'
        cloudModel.value = s.model || 'gpt-4o'
        cloudProviderId.value = s.provider || ''
        cloudApiKey.value = s.key || ''
    }
    saveCloudApiSettings()

    const savedMode = localStorage.getItem('aiMode')
    if (savedMode) aiSettingsMode.value = savedMode

    setupUpdateListeners()

    const raw = localStorage.getItem(SERVER_SETTINGS_KEY)
    if (raw) {
        const s = JSON.parse(raw)
        serverIP.value = s.serverIP || s.lanServerIP || '127.0.0.1'
        serverPort.value = s.serverPort || s.lanServerPort || '3000'
        enablePinyinSearch.value = s.enablePinyinSearch || false
    }

    const primaryRaw = localStorage.getItem('primaryServer')
    if (primaryRaw) {
        try {
            const p = JSON.parse(primaryRaw)
            primaryServerUrl.value = p.url || ''
        } catch {}
    }

    const savedDir = localStorage.getItem(getDownloadDirKey())
    if (savedDir) {
        downloadDir.value = savedDir
        if (window.electronAPI?.setDownloadDir) {
            window.electronAPI.setDownloadDir(savedDir)
        }
    } else     if (window.electronAPI?.getDownloadDir) {
        window.electronAPI.getDownloadDir().then((result) => {
            if (result.success) {
                downloadDir.value = result.dir
            }
        })
    }

    const e2e = localStorage.getItem('e2eEncryption')
    if (e2e) e2eEncryption.value = e2e

    const savedPPTDir = localStorage.getItem('pptDir')
    if (savedPPTDir) pptDir.value = savedPPTDir
    if (window.electronAPI?.setPPTDir) {
        window.electronAPI.setPPTDir(savedPPTDir || null)
    }

    const savedCtx = localStorage.getItem('aiContextTokens')
    if (savedCtx) contextTokens.value = parseInt(savedCtx) || 32000

    const navPreference = localStorage.getItem('settingsActiveNav')
    if (navPreference) {
        activeNav.value = navPreference
        localStorage.removeItem('settingsActiveNav')
    }

    loadTemplates()
    loadImgProviders()
    loadImageGenConfig()
})

onUnmounted(() => {
  if (window.electronAPI?.removeDebugListeners) { window.electronAPI.removeDebugListeners() }
  removeUpdateListeners()
})
watch(activeNav, (val) => {
  if (val === 'debug') loadDebugFiles()
})

const handleThemeChange = (value) => {
    settingsStore.toggleTheme(value)
}

const handleLanguageChange = (value) => {
    setLocale(value)
}

const handleUseSystemBrowserChange = (value) => {
    settingsStore.toggleUseSystemBrowser(value)
}

const handleSendKeyChange = (value) => {
    settingsStore.setSendKey(value)
}

const handleE2EChange = (value) => {
  localStorage.setItem('e2eEncryption', value)
}

const handleFriendListDensityChange = (value) => {
    settingsStore.setFriendListDensity(value)
}

const handleNavFlashIntensityChange = (value) => {
    settingsStore.setNavFlashIntensity(value)
}

const handleCacheRetentionDaysChange = (value) => {
    settingsStore.setCacheRetentionDays(value)
}

const handleShowModeUnreadBadgeChange = (value) => {
    settingsStore.setShowModeUnreadBadge(value)
}

const handleShowTabUnreadBadgeChange = (value) => {
    settingsStore.setShowTabUnreadBadge(value)
}

const handleShowOnlineStatusChange = (value) => {
    settingsStore.setShowOnlineStatus(value)
}

const PRIMARY_SERVER_KEY = 'primaryServer'

const saveServerSettings = async () => {
    const settings = {
        serverIP: serverIP.value,
        serverPort: serverPort.value,
        enablePinyinSearch: enablePinyinSearch.value
    }
    localStorage.setItem(SERVER_SETTINGS_KEY, JSON.stringify(settings))

    const url = `http://${serverIP.value}:${serverPort.value}`
    if (window.electronAPI?.setApiBaseUrl) {
        await window.electronAPI.setApiBaseUrl(url)
    }
}

const savePrimaryServerSetting = () => {
    if (primaryServerUrl.value) {
        localStorage.setItem(PRIMARY_SERVER_KEY, JSON.stringify({ url: primaryServerUrl.value }))
        ElMessage.success('主服务器地址已保存')
    } else {
        localStorage.removeItem(PRIMARY_SERVER_KEY)
    }
}

const savePinyinSearchSetting = () => {
    saveServerSettings()
}

const testServerConnection = async () => {
    if (!serverIP.value) {
        ElMessage.warning(t('settings.enterServerIP'))
        return
    }

    testingServer.value = true
    try {
        const response = await fetch(`http://${serverIP.value}:${serverPort.value}/health`, {
            method: 'GET'
        })
        if (response.ok) {
            ElMessage.success(t('settings.connectionSuccess'))
        } else {
            ElMessage.error(t('settings.connectionFailed'))
        }
    } catch (error) {
        ElMessage.error(t('settings.connectionError') + error.message)
    } finally {
        testingServer.value = false
    }
}

const handleOpenLink = async (url) => {
    if (useSystemBrowser.value && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url)
    } else {
        window.open(url, '_blank')
    }
}

const handleReportIssue = () => {
    handleOpenLink('https://github.com/12yierye/Electronic-Client/issues')
}

// ===== 自动更新逻辑 =====

// 监听更新状态事件
function setupUpdateListeners() {
  window.electronAPI?.onUpdateStatus((data) => {
    switch (data.status) {
      case 'checking':
        updateStatus.value = 'checking'
        checkingUpdate.value = true
        updateMessage.value = t('settings.checking')
        updateMessageType.value = 'info'
        break
      case 'update-available':
        updateStatus.value = 'available'
        checkingUpdate.value = false
        updateVersion.value = data.version
        updateMessage.value = t('settings.updateFound') + ': v' + data.version
        updateMessageType.value = 'info'
        break
      case 'update-not-available':
        updateStatus.value = 'idle'
        checkingUpdate.value = false
        updateMessage.value = t('settings.alreadyLatest') + ' (v' + appVersion + ')'
        updateMessageType.value = 'success'
        break
      case 'downloading':
        updateStatus.value = 'downloading'
        updateMessage.value = t('settings.downloading')
        updateMessageType.value = 'info'
        break
      case 'update-downloaded':
        updateStatus.value = 'downloaded'
        canInstall.value = true
        updateMessage.value = t('settings.downloadComplete')
        updateMessageType.value = 'success'
        break
      case 'error':
        updateStatus.value = 'error'
        checkingUpdate.value = false
        updateProgress.value = 0
        updateMessage.value = data.message || t('settings.updateFailed')
        updateMessageType.value = 'error'
        break
    }
  })

  window.electronAPI?.onUpdateProgress((data) => {
    updateProgress.value = data.percent
    updateSpeed.value = data.speed + ' MB/s'
  })
}

function removeUpdateListeners() {
  window.electronAPI?.removeUpdateListeners()
}

// 检查更新
const handleCheckUpdate = () => {
    updateMessage.value = ''
    updateMessageType.value = ''
    updateVersion.value = ''
    updateProgress.value = 0
    updateSpeed.value = ''
    canInstall.value = false
    window.electronAPI?.checkForUpdate(false)
}

// 下载更新
const handleDownloadUpdate = () => {
    window.electronAPI?.downloadUpdate()
}

// 安装更新
const handleInstallUpdate = () => {
    window.electronAPI?.installUpdate()
}

</script>

<style lang="scss" scoped>
.settings-view {
    height: calc(100vh - 60px);
    padding: 0;

    .settings-layout {
        display: flex;
        height: 100%;

        .settings-sidebar {
            width: 200px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            padding: 16px 0;
            overflow-y: auto;
            flex-shrink: 0;

            .settings-nav-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px;
                cursor: pointer;
                color: var(--text-secondary);
                transition: all 0.2s;
                font-size: 14px;

                .nav-icon {
                    font-size: 18px;
                }

                &:hover {
                    background: rgba(52, 152, 219, 0.08);
                    color: var(--text-primary);
                }

                &.active {
                    background: rgba(52, 152, 219, 0.15);
                    color: var(--accent-color);
                    font-weight: 500;
                    border-right: 3px solid var(--accent-color);
                }
            }
        }

        .settings-content {
            flex: 1;
            padding: 30px 40px;
            overflow-y: auto;
            background: var(--bg-primary);

            .settings-section {
                max-width: 600px;

                h3 {
                    margin: 0 0 20px;
                    color: var(--text-primary);
                    font-size: 18px;
                    font-weight: 600;
                }

                .el-form-item {
                    margin-bottom: 18px;
                    display: block !important;

                    :deep(.el-form-item__label) {
                        display: block;
                        color: var(--text-primary);
                        font-weight: 500;
                        margin-bottom: 6px;
                        padding: 0;
                        line-height: 1.4;
                        float: none;
                        width: auto;
                    }

                    :deep(.el-form-item__content) {
                        display: block !important;
                        width: 100%;
                        margin-left: 0 !important;
                    }
                }

                .badge-settings-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;

                    .badge-setting-row {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }

                    .switch-with-label {
                        display: flex;
                        align-items: center;
                        gap: 10px;

                        .badge-label {
                            font-size: 14px;
                            color: var(--text-primary);
                            font-weight: 500;
                        }
                    }

                    .setting-tip-inline {
                        font-size: 12px;
                        color: var(--text-secondary);
                        padding-left: 44px;
                    }
                }

                .language-selector {
                    width: 100%;

                    .el-select {
                        width: 200px;
                    }
                }

                .lang-option {
                    display: flex;
                    align-items: center;
                    gap: 8px;

                    .lang-flag {
                        font-size: 18px;
                    }

                    .lang-name {
                        font-size: 14px;
                    }
                }

                .setting-tip {
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin-top: 6px;
                    display: block;
                    line-height: 1.5;
                }

                .key-input-row {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                }

                .download-dir-row {
                    display: flex;
                    gap: 8px;

                    .el-input {
                        flex: 1;
                    }
                }

                .template-actions {
                    margin-bottom: 18px;
                }

                .about-info-list {
                    .about-row {
                        display: flex;
                        align-items: center;
                        padding: 10px 0;
                        border-bottom: 1px solid var(--border-color);

                        &:last-child {
                            border-bottom: none;
                        }

                        .about-label {
                            width: 100px;
                            flex-shrink: 0;
                            font-size: 14px;
                            color: var(--text-secondary);
                        }

                        .about-value {
                            font-size: 14px;
                            color: var(--text-primary);
                            font-weight: 500;
                        }

                        .el-link {
                            font-size: 14px;
                        }
                    }
                }

                .update-section {
                    .about-row {
                        display: flex;
                        align-items: center;
                        padding: 10px 0;
                        border-bottom: 1px solid var(--border-color);

                        .about-label {
                            width: 100px;
                            flex-shrink: 0;
                            font-size: 14px;
                            color: var(--text-secondary);
                        }

                        .about-value {
                            font-size: 14px;
                            color: var(--text-primary);
                            font-weight: 500;
                        }
                    }

                    .update-actions {
                        margin-top: 20px;
                        display: flex;
                        gap: 12px;
                        flex-wrap: wrap;
                    }

                    .update-progress-section {
                        margin-top: 16px;

                        .el-progress {
                            max-width: 400px;
                        }

                        .update-speed {
                            margin-top: 6px;
                            font-size: 12px;
                            color: var(--text-secondary);
                            text-align: right;
                            max-width: 400px;
                        }
                    }

                    .update-message {
                        margin-top: 16px;
                        padding: 10px 16px;
                        border-radius: 8px;
                        font-size: 14px;

                        &.success {
                            background: rgba(103, 194, 58, 0.1);
                            color: #67c23a;
                            border: 1px solid rgba(103, 194, 58, 0.2);
                        }

                        &.info {
                            background: rgba(64, 158, 255, 0.1);
                            color: #409eff;
                            border: 1px solid rgba(64, 158, 255, 0.2);
                        }

                        &.error {
                            background: rgba(245, 108, 108, 0.1);
                            color: #f56c6c;
                            border: 1px solid rgba(245, 108, 108, 0.2);
                        }
                    }
                }

                .switch-with-tip {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
            }
        }
    }
}
</style>

<style lang="scss">
.debug-section {
  .debug-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5; }
  .debug-topic-row { display: flex; gap: 8px; align-items: center; }
  .debug-progress { font-size: 13px; color: var(--text-secondary); margin: 12px 0; padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px; }
  .debug-result { margin-top: 16px; padding: 14px 16px; border-radius: 8px; border: 1px solid;
    &.success { background: rgba(103,194,58,0.08); border-color: rgba(103,194,58,0.2); }
    &.error { background: rgba(245,108,108,0.08); border-color: rgba(245,108,108,0.2); }
    .debug-result-title { font-weight: 600; font-size: 15px; margin-bottom: 6px; }
    .debug-result-msg { font-size: 13px; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.4; }
    .debug-result-meta { font-size: 12px; color: var(--text-secondary); margin-top: 8px; opacity: 0.7; }
  }
  .debug-history-header { display: flex; align-items: center; justify-content: space-between; h4 { margin: 0; font-size: 14px; color: var(--text-primary); } }
  .debug-empty { font-size: 13px; color: var(--text-secondary); padding: 20px 0; text-align: center; }
  .debug-file-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px;
    .debug-file-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; border: 1px solid var(--border-color);
      &:hover { background: var(--bg-secondary); }
      .debug-file-icon { flex-shrink: 0; color: var(--accent-color); opacity: 0.6; }
      .debug-file-info { flex: 1; min-width: 0; }
      .debug-file-name { font-size: 14px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .debug-file-meta { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    }
  }
}
.template-dialog-form .el-form-item { display: flex !important; }
.template-dialog-form .el-form-item__label { width: 70px !important; float: left !important; display: inline-block !important; text-align: right; padding-right: 12px; }
.template-dialog-form .el-form-item__content { margin-left: 70px !important; display: block !important; }
.img-test-result { margin-left: 8px; font-size: 12px; display: inline; }
.img-test-result.success { color: #67c23a; }
.img-test-result.error { color: #f56c6c; }
.img-provider-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
.img-provider-item { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 12px; background: var(--el-fill-color-lighter); }
.img-provider-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.img-provider-name { font-weight: 600; font-size: 14px; flex: 1; }
.img-provider-key { margin-bottom: 4px; }
.img-provider-desc { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.4; }
.img-provider-builtin-hint { font-size: 12px; color: var(--el-color-success); margin-bottom: 4px; }
.img-search-test-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.img-test-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 6px; margin-top: 8px; }
.img-test-thumb { border-radius: 4px; overflow: hidden; cursor: pointer; border: 1px solid var(--el-border-color); background: var(--el-fill-color-lighter); transition: transform 0.12s;
  &:hover { transform: scale(1.05); }
  img { width: 100%; height: 75px; object-fit: cover; display: block; }
  .img-test-thumb-label { font-size: 10px; color: var(--el-text-color-secondary); padding: 1px 4px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
</style>
