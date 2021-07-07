import QuestDB from './QuestDB.js';
import Utils   from './Utils.js';

import { constants, questTypes, questTypesI18n, settings } from '../model/constants.js';

/**
 * Enrich populates content with a lot of additional data that doesn't necessarily have to be saved
 * with the Quest itself such as Actor data.
 *
 * All enrich methods should only be used in getData of various Foundry apps / views.
 */
export default class Enrich
{
   static async giverFromQuest(quest)
   {
      let data = null;

      if (quest.giver === 'abstract')
      {
         data = {
            name: quest.giverName,
            img: quest.image,
            hasTokenImg: false
         };
      }
      else if (typeof quest.giver === 'string')
      {
         data = Enrich.giverFromUUID(quest.giver, quest.image);
      }

      return data;
   }

   static async giverFromUUID(uuid, imageType = 'actor')
   {
      let data = null;

      if (typeof uuid === 'string')
      {
         const document = await fromUuid(uuid);

         if (document !== null)
         {
            switch (document.documentName)
            {
               case Actor.documentName:
               {
                  const actorImage = document.img;
                  const tokenImage = document?.data?.token?.img;
                  const hasTokenImg = typeof tokenImage === 'string' && tokenImage !== actorImage;

                  data = {
                     uuid,
                     name: document.name,
                     img: imageType === 'token' && hasTokenImg ? tokenImage : actorImage,
                     hasTokenImg
                  };
                  break;
               }

               case Item.documentName:
                  data = {
                     uuid,
                     name: document.name,
                     img: document.img,
                     hasTokenImg: false
                  };
                  break;

               case JournalEntry.documentName:
                  data = {
                     uuid,
                     name: document.name,
                     img: document.data.img,
                     hasTokenImg: false
                  };
                  break;
            }
         }
      }

      return data;
   }

   /**
    * @param {SortedQuests}   sortedQuests
    *
    * @returns {Promise<object>}
    */
   static async sorted(sortedQuests)
   {
      const data = {};

      for (const key in sortedQuests)
      {
         data[key] = [];
         for (const quest of sortedQuests[key])
         {
            const questView = await Enrich.quest(quest);
            data[key].push(questView);
         }
      }

      return data;
   }

   static statusActions(quest)
   {
      let result = '';

      const isTrustedPlayerEdit = Utils.isTrustedPlayerEdit();
      const canAccept = game.settings.get(constants.moduleName, settings.allowPlayersAccept);
      const canEdit = game.user.isGM || (isTrustedPlayerEdit && quest.isOwner);

      let addedAction = false;

      result += `<div class="actions quest-status${!isTrustedPlayerEdit && !canEdit ? ' is-player' : ''}">`;

      if (canEdit || canAccept)
      {
         if (canEdit && questTypes.active === quest.status)
         {
            result += `<i class="move fas fa-check-circle" title="${game.i18n.localize('ForienQuestLog.Tooltips.SetCompleted')}" data-target="completed" data-quest-id="${quest.id}"></i>\n`;
            result += `<i class="move fas fa-times-circle" title="${game.i18n.localize('ForienQuestLog.Tooltips.SetFailed')}" data-target="failed" data-quest-id="${quest.id}"></i>\n`;
            addedAction = true;
         }

         if ((canEdit && questTypes.inactive === quest.status) || questTypes.available === quest.status)
         {
            result += `<i class="move fas fa-play" title="${game.i18n.localize('ForienQuestLog.Tooltips.SetActive')}" data-target="active" data-quest-id="${quest.id}"></i>\n`;
            addedAction = true;
         }

         if (canEdit && questTypes.inactive !== quest.status)
         {
            result += `<i class="move fas fa-stop-circle" title="${game.i18n.localize('ForienQuestLog.Tooltips.Hide')}" data-target="inactive" data-quest-id="${quest.id}"></i>\n`;
            addedAction = true;
         }

         if ((canEdit && questTypes.inactive === quest.status) || questTypes.active === quest.status)
         {
            result += `<i class="move fas fa-clipboard" title="${game.i18n.localize('ForienQuestLog.Tooltips.SetAvailable')}" data-target="available" data-quest-id="${quest.id}"></i>\n`;
            addedAction = true;
         }

         if (canEdit)
         {
            result += `<i class="delete fas fa-trash" title="${game.i18n.localize('ForienQuestLog.Tooltips.Delete')}" data-quest-id="${quest.id}" data-quest-name="${quest.name}"></i>\n`;
            addedAction = true;
         }

         result += `</div>\n`;
      }

      return isTrustedPlayerEdit || addedAction ? result : '';
   }

   /**
    * This method also performs content manipulation, for example enriching HTML or calculating amount
    * of done/total tasks etc.
    *
    * @param {Quest}  quest - Quest data to construct view data.
    *
    * @returns {object} A single quest view or SortedQuests upgraded
    */
   static quest(quest)
   {
      const data = JSON.parse(JSON.stringify(quest.toJSON()));
      data.id = quest.id;
      data.isHidden = quest.isHidden;
      data.isInactive = questTypes.inactive === data.status;

      const personalActors = quest.getPersonalActors();

      const isTrustedPlayerEdit = Utils.isTrustedPlayerEdit();
      const canEdit =  game.user.isGM || (quest.isOwner && isTrustedPlayerEdit);

      const canPlayerAccept = game.settings.get(constants.moduleName, settings.allowPlayersAccept);
      const canPlayerDrag = game.settings.get(constants.moduleName, settings.allowPlayersDrag);
      const countHidden = game.settings.get(constants.moduleName, settings.countHidden);

      data.canEdit = canEdit;

      data.wrapNameLengthCSS = 'player';
      if (canPlayerAccept || quest.isOwner) { data.wrapNameLengthCSS = 'player-edit'; }
      if (canEdit) { data.wrapNameLengthCSS = 'can-edit'; }

      data.isPersonal = personalActors.length > 0;
      data.personalActors = personalActors.map((a) => a.name).sort((a, b) => a.localeCompare(b)).join('&#013;');

      data.description = TextEditor.enrichHTML(data.description);

      data.data_giver = typeof data.giverData === 'object' ? data.giverData : null;

      data.questIconType = void 0;

      if (data.splashAsIcon && data.splash.length)
      {
         data.questIconType = 'splash-image';
      }
      else if (data.data_giver && data.data_giver.img)
      {
         data.questIconType = 'quest-giver';
      }

      data.statusLabel = game.i18n.localize(`ForienQuestLog.QuestTypes.Labels.${data.status}`);

      data.statusActions = Enrich.statusActions(quest);

      data.isSubquest = false;

      data.data_parent = {};

      if (data.parent !== null)
      {
         const parentQuest = QuestDB.getQuest(data.parent);
         if (parentQuest)
         {
            data.isSubquest = parentQuest.isObservable;

            data.data_parent = {
               id: data.parent,
               giver: parentQuest.giver,
               name: parentQuest.name,
               status: parentQuest.status
            };
         }
      }

      data.data_subquest = [];

      if (data.subquests !== void 0)
      {
         for (const questId of data.subquests)
         {
            const subquest = QuestDB.getQuest(questId);

            // isObservable filters out non-owned hidden quests for trustedPlayerEdit.
            if (subquest && subquest.isObservable)
            {
               // Mirror Task data for state / button state
               let state = 'square';
               switch (subquest.status)
               {
                  case questTypes.completed:
                     state = 'check-square';
                     break;
                  case questTypes.failed:
                     state = 'minus-square';
                     break;
               }

               const subPersonalActors = subquest.getPersonalActors();

               const isInactive = subquest.isInactive;

               const statusTooltipData = isInactive ?
                { statusI18n: game.i18n.localize(questTypesI18n[questTypes.inactive]) } :
                 { statusI18n: game.i18n.localize(questTypesI18n[subquest.status]) };

               const statusTooltip = game.i18n.format('ForienQuestLog.Tooltips.Status', statusTooltipData);

               const canEditSubquest = game.user.isGM || (subquest.isOwner && isTrustedPlayerEdit);

               data.data_subquest.push({
                  id: questId,
                  giver: subquest.giver,
                  name: subquest.name,
                  status: subquest.status,
                  statusTooltip,
                  state,
                  statusActions: Enrich.statusActions(subquest),
                  canEdit: canEditSubquest,
                  isHidden: subquest.isHidden,
                  isInactive,
                  isPersonal: subPersonalActors.length > 0,
                  personalActors: subPersonalActors.map((a) => a.name).sort((a, b) => a.localeCompare(b)).join('&#013;')
               });
            }
         }
      }

      if (countHidden)
      {
         data.checkedTasks = data.tasks.filter((t) => t.completed).length;

         const finishedSubquests = data.data_subquest.filter((s) => questTypes.completed === s.status).length;

         data.checkedTasks += finishedSubquests;

         data.totalTasks = data.tasks.length + data.data_subquest.length;
      }
      else
      {
         data.checkedTasks = data.tasks.filter((t) => !t.hidden && t.completed).length;

         const finishedSubquests = data.data_subquest.filter(
          (s) => !s.isObservable && !s.isInactive && questTypes.completed === s.status).length;

         data.checkedTasks += finishedSubquests;

         data.totalTasks = data.tasks.filter((t) => !t.hidden).length +
          data.data_subquest.filter((s) => !s.isObservable && !s.isInactive).length;
      }

      switch (game.settings.get(constants.moduleName, settings.showTasks))
      {
         case 'default':
            data.taskCountLabel = `(${data.checkedTasks}/${data.totalTasks})`;
            break;

         case 'onlyCurrent':
            data.taskCountLabel = `(${data.checkedTasks})`;
            break;

         default:
            data.taskCountLabel = '';
            break;
      }

      data.data_tasks = data.tasks.map((task) =>
      {
         // Note: We no longer are allowing user data to be enriched / currently escaping in Handlebars template.
         // XSS vulnerability w/ script data entered by user. This may change in the future as it might be possible to
         // provide a regex to verify and only upgrade content links and avoid scripts though that is a hard task.
         // task.name = TextEditor.enrichHTML(task.name);

         return task;
      });

      data.data_rewards = data.rewards.map((item) =>
      {
         const type = item.type.toLowerCase();

         const draggable = (canEdit || canPlayerDrag) && (canEdit || !item.locked) && type !== 'abstract';

         const lockedTooltip = canEdit ? game.i18n.localize('ForienQuestLog.Tooltips.RewardLocked') :
          game.i18n.localize('ForienQuestLog.Tooltips.RewardLockedPlayer');

         const unlockedTooltip = canEdit ? game.i18n.localize('ForienQuestLog.Tooltips.RewardUnlocked') :
          game.i18n.localize('ForienQuestLog.Tooltips.RewardUnlockedPlayer');

         return {
            name: item.data.name,
            img: item.data.img,
            type,
            hidden: item.hidden,
            locked: item.locked,
            lockedTooltip,
            unlockedTooltip,
            isPlayerLink: !canEdit && !canPlayerDrag && !item.locked && type !== 'abstract',
            draggable,
            transfer: type !== 'abstract' ? JSON.stringify(
             { uuid: item.data.uuid, uuidv4: item.uuidv4, name: item.data.name }) : void 0,
            uuidv4: item.uuidv4
         };
      });

      if (!canEdit)
      {
         data.data_tasks = data.data_tasks.filter((t) => t.hidden === false);
         data.data_rewards = data.data_rewards.filter((r) => r.hidden === false);
      }

      return data;
   }
}