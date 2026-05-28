import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export function useWorkspaceUser() {
  const [userId, setUserId] = useState(() => {
    const cached = localStorage.getItem('sheryai_workspace_uid');
    if (cached) return cached;
    const newUid = uuidv4();
    localStorage.setItem('sheryai_workspace_uid', newUid);
    return newUid;
  });

  return { userId };
}

export default useWorkspaceUser;
