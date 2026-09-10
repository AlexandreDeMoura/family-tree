import { Navigate, Route, Routes } from 'react-router';
import { FamilyEditorPage } from './features/organizer/FamilyEditorPage';
import { OrganizerHomePage } from './features/organizer/OrganizerHomePage';
import { ProtectedRoute } from './features/organizer/ProtectedRoute';
import { SignInPage } from './features/organizer/SignInPage';
import { ViewerPage } from './features/sharing/ViewerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/view/:treeId" element={<ViewerPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/organizer" element={<OrganizerHomePage />} />
        <Route path="/organizer/trees/:treeId" element={<FamilyEditorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/organizer" replace />} />
    </Routes>
  );
}
