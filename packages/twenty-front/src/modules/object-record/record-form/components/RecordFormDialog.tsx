import { SidePanelRecordCreationFormPage } from '@/side-panel/pages/record-creation-form/components/SidePanelRecordCreationFormPage';
import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { DialogInstance } from '@/ui/layout/dialog/components/DialogInstance';
import { t } from '@lingui/core/macro';
import { Dialog } from 'twenty-ui/primitives/surfaces';
import { useState } from 'react';
import { SidePanelRecordCreationFormSettings } from '@/side-panel/pages/record-creation-form-settings/components/SidePanelRecordCreationFormSettingsPage';
import { recordCreationFormRequestComponentState } from '@/side-panel/pages/record-creation-form/states/recordCreationFormRequestComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

type RecordFormDialogProps = {
  requestId: string;
  isSubmitting: boolean;
  onCancel: () => void;
};

export const RecordFormDialog = ({
  requestId,
  isSubmitting,
  onCancel,
}: RecordFormDialogProps) => {
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const recordCreationFormRequest = useAtomComponentStateValue(
    recordCreationFormRequestComponentState,
    requestId,
  );
  return (
    <SidePanelPageComponentInstanceContext.Provider
      value={{ instanceId: requestId }}
    >
      <DialogInstance
        dialogId={requestId}
        dismissible={!isSubmitting}
        closeOnDismiss={false}
        onClose={onCancel}
        renderInDocumentBody
      >
        {({ onKeyDown }) => (
          <Dialog.Popup
            onKeyDown={onKeyDown}
            size="lg"
            style={{
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              height: 'min(720px, 85dvh)',
              maxHeight: '85dvh',
            }}
          >
            <Dialog.Title
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clipPath: 'inset(50%)',
              }}
            >{t`Record form`}</Dialog.Title>
            {isEditingSettings && recordCreationFormRequest ? (
              <SidePanelRecordCreationFormSettings
                objectMetadataId={recordCreationFormRequest.objectMetadataId}
                onClose={() => setIsEditingSettings(false)}
              />
            ) : (
              <SidePanelRecordCreationFormPage
                onEditSettings={() => setIsEditingSettings(true)}
                onCancel={onCancel}
              />
            )}
          </Dialog.Popup>
        )}
      </DialogInstance>
    </SidePanelPageComponentInstanceContext.Provider>
  );
};
