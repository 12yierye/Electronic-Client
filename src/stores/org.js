import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useOrgStore = defineStore('org', () => {
  const tree = ref(null)
  const loading = ref(false)
  const selectedNodeId = ref(null)
  const expandedKeys = ref([])

  const flatNodes = computed(() => {
    if (!tree.value) return []
    const result = []
    function walk(node) {
      result.push(node)
      if (node.children) node.children.forEach(walk)
    }
    walk(tree.value)
    return result
  })

  function findNode(nodeId) {
    return flatNodes.value.find(n => n.id === nodeId)
  }

  function getAncestors(nodeId) {
    const ancestors = []
    function find(parent, id) {
      if (!parent) return false
      if (parent.children) {
        for (const child of parent.children) {
          if (child.id === id) {
            ancestors.push(parent)
            return true
          }
          if (find(child, id)) {
            ancestors.push(parent)
            return true
          }
        }
      }
      return false
    }
    find(tree.value, nodeId)
    return ancestors.reverse()
  }

  function collectMembers(node) {
    let members = [...(node.members || [])]
    if (node.children) {
      node.children.forEach(child => {
        members.push(...collectMembers(child))
      })
    }
    return [...new Set(members)]
  }

  async function fetchTree() {
    if (!window.electronAPI?.org) return
    loading.value = true
    try {
      const res = await window.electronAPI.org.getTree()
      if (res.success !== false && res.tree) {
        tree.value = res.tree
      } else {
        tree.value = res
      }
    } catch {
      tree.value = null
    }
    loading.value = false
  }

  async function addNode(parentId, name, type) {
    if (!window.electronAPI?.org) return
    const res = await window.electronAPI.org.addNode({ parentId, name, type })
    if (res.success !== false) await fetchTree()
    return res
  }

  async function removeNode(nodeId) {
    if (!window.electronAPI?.org) return
    const res = await window.electronAPI.org.removeNode(nodeId)
    if (res.success !== false) await fetchTree()
    return res
  }

  async function addMembers(nodeId, userIds) {
    if (!window.electronAPI?.org) return
    const res = await window.electronAPI.org.manageMembers({ nodeId, userIds, action: 'add' })
    if (res.success !== false) await fetchTree()
    return res
  }

  async function removeMembers(nodeId, userIds) {
    if (!window.electronAPI?.org) return
    const res = await window.electronAPI.org.manageMembers({ nodeId, userIds, action: 'remove' })
    if (res.success !== false) await fetchTree()
    return res
  }

  function getMembersOfNode(nodeId) {
    const node = findNode(nodeId)
    if (!node) return []
    return collectMembers(node)
  }

  return {
    tree, loading, selectedNodeId, expandedKeys,
    flatNodes,
    fetchTree, addNode, removeNode, addMembers, removeMembers,
    findNode, getAncestors, getMembersOfNode, collectMembers
  }
})
