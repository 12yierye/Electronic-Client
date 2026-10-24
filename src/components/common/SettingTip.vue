<template>
    <el-tooltip :content="text" placement="right" :show-after="150" :disabled="!text">
        <el-icon :class="['setting-tip-icon', { inline }]"><QuestionFilled /></el-icon>
    </el-tooltip>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'

defineProps({
    inline: Boolean
})

const slots = useSlots()

function flatten(nodes) {
    let out = ''
    for (const node of nodes || []) {
        if (typeof node === 'string' || typeof node === 'number') {
            out += node
        } else if (node && node.children) {
            out += flatten(Array.isArray(node.children) ? node.children : [node.children])
        }
    }
    return out
}

const text = computed(() => flatten(slots.default?.() || []).trim())
</script>

<style scoped>
.setting-tip-icon {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: help;
    transition: color 0.15s;
}

.setting-tip-icon:hover {
    color: var(--accent-color);
}

.setting-tip-icon.inline {
    position: static;
    margin-left: 4px;
    vertical-align: middle;
}
</style>
