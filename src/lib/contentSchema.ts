import { GameObject, GameState, Item, Scene } from '../types';

export interface ContentRegistry {
  items: Record<string, Item>;
  objects: Record<string, GameObject>;
  scenes: Record<string, Scene>;
  initialState: GameState;
}

export interface ContentValidationIssue {
  path: string;
  message: string;
}

export interface ContentValidationResult {
  valid: boolean;
  issues: ContentValidationIssue[];
}

function addIssue(issues: ContentValidationIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateItemCatalog(items: Record<string, Item>, issues: ContentValidationIssue[]) {
  for (const [itemId, item] of Object.entries(items)) {
    if (!item?.id) addIssue(issues, `items.${itemId}`, 'Item id is required.');
    if (item.id !== itemId) addIssue(issues, `items.${itemId}.id`, 'Item id must match registry key.');
    if (!item.name?.trim()) addIssue(issues, `items.${itemId}.name`, 'Item name is required.');
    if (!item.description?.trim()) addIssue(issues, `items.${itemId}.description`, 'Item description is required.');
    if (!item.useText?.trim()) addIssue(issues, `items.${itemId}.useText`, 'Item useText is required.');
  }
}

function validateObjects(objects: Record<string, GameObject>, items: Record<string, Item>, issues: ContentValidationIssue[]) {
  for (const [objId, obj] of Object.entries(objects)) {
    if (!obj?.id) addIssue(issues, `objects.${objId}`, 'Object id is required.');
    if (obj.id !== objId) addIssue(issues, `objects.${objId}.id`, 'Object id must match registry key.');
    if (!obj.name?.trim()) addIssue(issues, `objects.${objId}.name`, 'Object name is required.');
    if (!isRecord(obj.descriptions) || Object.keys(obj.descriptions).length === 0) {
      addIssue(issues, `objects.${objId}.descriptions`, 'Object descriptions must include at least one key.');
    }
    if (!Array.isArray(obj.interactions) || obj.interactions.length === 0) {
      addIssue(issues, `objects.${objId}.interactions`, 'Object interactions must include at least one interaction.');
      continue;
    }

    const ids = new Set<string>();
    for (let idx = 0; idx < obj.interactions.length; idx += 1) {
      const it = obj.interactions[idx];
      const p = `objects.${objId}.interactions[${idx}]`;
      if (!it.regex?.trim()) {
        addIssue(issues, `${p}.regex`, 'Interaction regex is required.');
      } else {
        try {
          new RegExp(`^${it.regex}$`, 'i');
        } catch {
          addIssue(issues, `${p}.regex`, 'Interaction regex is invalid.');
        }
      }
      if (it.id) {
        if (ids.has(it.id)) addIssue(issues, `${p}.id`, `Duplicate interaction id "${it.id}".`);
        ids.add(it.id);
      }
      if (it.reuseInteractionId && it.reuseInteractionId !== 'examine') {
        const hasReuseTarget = obj.interactions.some((candidate) => candidate.id === it.reuseInteractionId);
        if (!hasReuseTarget) {
          addIssue(
            issues,
            `${p}.reuseInteractionId`,
            `reuseInteractionId "${it.reuseInteractionId}" does not exist on object "${objId}".`,
          );
        }
      }
      for (const reqId of [...(it.requiresInventory ?? []), ...(it.getItem ? [it.getItem] : []), ...(it.removeItem ? [it.removeItem] : [])]) {
        if (!items[reqId]) addIssue(issues, p, `Unknown item reference "${reqId}".`);
      }
    }
  }
}

function validateScenes(
  scenes: Record<string, Scene>,
  objects: Record<string, GameObject>,
  items: Record<string, Item>,
  issues: ContentValidationIssue[],
) {
  for (const [sceneId, scene] of Object.entries(scenes)) {
    if (!scene?.id) addIssue(issues, `scenes.${sceneId}`, 'Scene id is required.');
    if (scene.id !== sceneId) addIssue(issues, `scenes.${sceneId}.id`, 'Scene id must match registry key.');
    if (!scene.title?.trim()) addIssue(issues, `scenes.${sceneId}.title`, 'Scene title is required.');
    if (!scene.description?.trim()) addIssue(issues, `scenes.${sceneId}.description`, 'Scene description is required.');
    for (const objId of scene.objects ?? []) {
      if (!objects[objId]) addIssue(issues, `scenes.${sceneId}.objects`, `Unknown object reference "${objId}".`);
    }
    for (const [exitDir, nextSceneId] of Object.entries(scene.exits ?? {})) {
      if (!nextSceneId?.trim()) addIssue(issues, `scenes.${sceneId}.exits.${exitDir}`, 'Exit scene id is required.');
      if (nextSceneId && !scenes[nextSceneId]) addIssue(issues, `scenes.${sceneId}.exits.${exitDir}`, `Unknown scene "${nextSceneId}".`);
    }
    for (const [regex, cmd] of Object.entries(scene.commands ?? {})) {
      const p = `scenes.${sceneId}.commands[${regex}]`;
      try {
        new RegExp(`^${regex}$`, 'i');
      } catch {
        addIssue(issues, p, 'Scene command regex key is invalid.');
      }
      if (cmd.nextScene && !scenes[cmd.nextScene]) addIssue(issues, `${p}.nextScene`, `Unknown scene "${cmd.nextScene}".`);
      for (const reqId of [...(cmd.requiresInventory ?? []), ...(cmd.getItem ? [cmd.getItem] : []), ...(cmd.removeItem ? [cmd.removeItem] : [])]) {
        if (!items[reqId]) addIssue(issues, p, `Unknown item reference "${reqId}".`);
      }
    }
  }
}

export function validateContentRegistry(registry: ContentRegistry): ContentValidationResult {
  const issues: ContentValidationIssue[] = [];
  validateItemCatalog(registry.items, issues);
  validateObjects(registry.objects, registry.items, issues);
  validateScenes(registry.scenes, registry.objects, registry.items, issues);

  if (!registry.scenes[registry.initialState.currentSceneId]) {
    addIssue(
      issues,
      'initialState.currentSceneId',
      `Initial state references missing scene "${registry.initialState.currentSceneId}".`,
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateContentRegistryOrThrow(registry: ContentRegistry): ContentRegistry {
  const result = validateContentRegistry(registry);
  if (!result.valid) {
    const detail = result.issues.map((i) => `- ${i.path}: ${i.message}`).join('\n');
    throw new Error(`Content schema validation failed:\n${detail}`);
  }
  return registry;
}
