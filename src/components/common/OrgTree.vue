<template>
  <div class="org-tree-panel">
    <div class="org-tree-header">
      <span class="header-title">{{ t('org.title') }}</span>
      <el-button
        v-if="canManage"
        :icon="Plus"
        size="small"
        circle
        @click="showAddRootDialog = true"
      />
    </div>

    <el-tree
      v-if="store.tree"
      :data="treeData"
      node-key="id"
      :props="treeProps"
      :expand-on-click-node="true"
      highlight-current
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data }">
        <div class="org-tree-node">
          <el-icon class="node-type-icon">
            <OfficeBuilding v-if="data.type === 'school'" />
            <Collection v-else-if="data.type === 'grade'" />
            <User v-else />
          </el-icon>
          <span class="node-label">{{ data.name }}</span>
          <span class="node-count" v-if="data.members?.length">
            {{ data.members.length }}
          </span>
          <span class="node-actions" v-if="canManage && data.type !== 'school'" @click.stop>
            <el-button :icon="Plus" size="small" text @click="openAddChild(data)" />
            <el-button :icon="Delete" size="small" text @click="confirmRemove(data)" />
          </span>
        </div>
      </template>
    </el-tree>
    <el-empty v-else-if="!store.loading" :description="t('org.empty')" />

    <el-dialog v-model="showAddRootDialog" :title="t('org.addNode')" width="360px">
      <el-form label-width="70px">
        <el-form-item :label="t('org.name')">
          <el-input v-model="newNodeName" :placeholder="t('org.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('org.type')">
          <el-select v-model="newNodeType" style="width:100%">
            <el-option :label="t('org.typeGrade')" value="grade" />
            <el-option :label="t('org.typeClass')" value="class" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRootDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleAddRoot">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAddChildDialog" :title="t('org.addChild')" width="360px">
      <el-form label-width="70px">
        <el-form-item :label="t('org.name')">
          <el-input v-model="newChildName" :placeholder="t('org.namePlaceholder')" />
        </el-form-item>
        <el-form-item v-if="parentNodeType === 'grade'" :label="t('org.type')">
          <el-select v-model="newChildType" style="width:100%">
            <el-option :label="t('org.typeClass')" value="class" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddChildDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleAddChild">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Plus, Delete, OfficeBuilding, Collection, User } from '@element-plus/icons-vue'
import { useOrgStore } from '@/stores/org'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()
const store = useOrgStore()

const emit = defineEmits(['select-members', 'node-select'])

const canManage = ref(false)

const showAddRootDialog = ref(false)
const showAddChildDialog = ref(false)
const newNodeName = ref('')
const newNodeType = ref('grade')
const newChildName = ref('')
const newChildType = ref('class')
const parentNodeType = ref('')
const pendingParentId = ref('')

const treeData = computed(() => {
  if (!store.tree) return []
  return [store.tree]
})

const treeProps = {
  children: 'children',
  label: 'name'
}

function handleNodeClick(node) {
  store.selectedNodeId = node.id
  emit('node-select', node)
}

async function openAddChild(node) {
  pendingParentId.value = node.id
  parentNodeType.value = node.type
  if (node.type === 'grade') {
    newChildType.value = 'class'
  }
  newChildName.value = ''
  showAddChildDialog.value = true
}

async function handleAddRoot() {
  if (!newNodeName.value.trim()) return
  const parentId = store.tree?.id || 'root'
  await store.addNode(parentId, newNodeName.value.trim(), newNodeType.value)
  newNodeName.value = ''
  showAddRootDialog.value = false
}

async function handleAddChild() {
  if (!newChildName.value.trim()) return
  const type = parentNodeType.value === 'grade' ? newChildType.value : 'class'
  await store.addNode(pendingParentId.value, newChildName.value.trim(), type)
  newChildName.value = ''
  showAddChildDialog.value = false
}

async function confirmRemove(node) {
  await store.removeNode(node.id)
}

onMounted(async () => {
  await store.fetchTree()
  if (store.tree && store.tree.children?.length > 0) {
    store.expandedKeys = store.tree.children.map(c => c.id)
  }
})
</script>

<style lang="scss" scoped>
.org-tree-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.org-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);

  .header-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

:deep(.el-tree) {
  background: transparent;
  color: var(--text-primary);
  padding: 8px 0;

  .el-tree-node__content {
    height: 36px;
    padding: 0 8px;

    &:hover {
      background: rgba(52, 152, 219, 0.08);
    }
  }

  .el-tree-node.is-current > .el-tree-node__content {
    background: rgba(52, 152, 219, 0.15);
    color: var(--accent-color);
  }
}

.org-tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;

  .node-type-icon {
    font-size: 16px;
    color: var(--accent-color);
    flex-shrink: 0;
  }

  .node-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  .node-count {
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border-radius: 10px;
    padding: 0 6px;
    min-width: 18px;
    text-align: center;
    line-height: 18px;
    flex-shrink: 0;
  }

  .node-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover .node-actions {
    opacity: 1;
  }
}
</style>
