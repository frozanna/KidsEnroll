# REST API Plan - KidsEnroll

## 1. Resources

| Resource | Database Table | Description |
|----------|---------------|-------------|
| Auth | users (via Supabase Auth) | User authentication and registration |
| Facility | facility | Facilietes that provides activities for children (only 1 row in MVP) |
| Profiles | profiles | User profile information and roles |
| Children | children | Child profiles managed by parents |
| Workers | workers | Activity instructors/caregivers |
| Activities | activities | Activities offered by facility |
| Enrollments | enrollments | Child enrollments in activities |
| Activity Tags | activity_tags | Tags categorizing activities |

## 2. Endpoints

### 2.1 Profile Endpoints

#### Get Current User Profile
- **Method:** GET
- **Path:** `/api/profile`
- **Description:** Retrieve current authenticated user's profile
- **Authentication:** Required (Parent role)
- **Success Response (200 OK):**
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "parent",
  "created_at": "2025-01-15T10:00:00Z"
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 404 Not Found: Profile not found

#### Update Current User Profile
- **Method:** PATCH
- **Path:** `/api/profile`
- **Description:** Update current user's profile information
- **Authentication:** Required (Parent role)
- **Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe"
}
```
- **Success Response (200 OK):**
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "parent",
  "created_at": "2025-01-15T10:00:00Z"
}
```
- **Error Responses:**
  - 400 Bad Request: Invalid data format
  - 401 Unauthorized: Invalid or expired token
  - 404 Not Found: Profile not found

### 2.2 Children Endpoints

#### List Children
- **Method:** GET
- **Path:** `/api/children`
- **Description:** Get all children belonging to current parent
- **Authentication:** Required (Parent role)
- **Success Response (200 OK):**
```json
{
  "children": [
    {
      "id": 1,
      "first_name": "Alice",
      "last_name": "Smith",
      "birth_date": "2020-05-15",
      "description": "Enjoys drawing and music",
      "created_at": "2025-01-10T10:00:00Z"
    }
  ]
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not a parent

#### Get Child by ID
- **Method:** GET
- **Path:** `/api/children/:id`
- **Description:** Get specific child details (only if belongs to current parent)
- **Authentication:** Required (Parent role)
- **Success Response (200 OK):**
```json
{
  "id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing and music",
  "created_at": "2025-01-10T10:00:00Z"
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: Child does not belong to current parent
  - 404 Not Found: Child not found

#### Create Child
- **Method:** POST
- **Path:** `/api/children`
- **Description:** Add a new child profile for current parent
- **Authentication:** Required (Parent role)
- **Request Body:**
```json
{
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing and music"
}
```
- **Success Response (201 Created):**
```json
{
  "id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing and music",
  "parent_id": "uuid-string",
  "created_at": "2025-01-10T10:00:00Z"
}
```
- **Error Responses:**
  - 400 Bad Request: Missing required fields or invalid data format
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not a parent

#### Update Child
- **Method:** PATCH
- **Path:** `/api/children/:id`
- **Description:** Update child profile information
- **Authentication:** Required (Parent role)
- **Request Body:**
```json
{
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing, music, and sports"
}
```
- **Success Response (200 OK):**
```json
{
  "id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing, music, and sports",
  "parent_id": "uuid-string",
  "created_at": "2025-01-10T10:00:00Z"
}
```
- **Error Responses:**
  - 400 Bad Request: Invalid data format
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: Child does not belong to current parent
  - 404 Not Found: Child not found

### 2.3 Activity Endpoints (Parent Access)

#### List Activities
- **Method:** GET
- **Path:** `/api/activities`
- **Description:** Get all available activities with enrollment information
- **Authentication:** Required (Parent role)
- **Query Parameters:**
  - `hasAvailableSpots` (boolean, optional): Filter activities with available spots
  - `startDate` (ISO date, optional): Filter activities starting from date
  - `endDate` (ISO date, optional): Filter activities until date
  - `tags` (comma-separated string, optional): Filter by tags
  - `page` (integer, default: 1): Page number for pagination
  - `limit` (integer, default: 20, max: 100): Items per page
- **Success Response (200 OK):**
```json
{
  "activities": [
    {
      "id": 1,
      "name": "Art Class",
      "description": "Creative painting and drawing",
      "cost": 45.00,
      "participant_limit": 10,
      "available_spots": 3,
      "start_datetime": "2025-01-20T14:00:00Z",
      "worker": {
        "id": 1,
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@facility.com"
      },
      "tags": ["art", "creative"],
      "created_at": "2025-01-05T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```
- **Error Responses:**
  - 400 Bad Request: Invalid query parameters
  - 401 Unauthorized: Invalid or expired token

#### Get Activity by ID
- **Method:** GET
- **Path:** `/api/activities/:id`
- **Description:** Get detailed information about a specific activity
- **Authentication:** Required (Parent role)
- **Success Response (200 OK):**
```json
{
  "id": 1,
  "name": "Art Class",
  "description": "Creative painting and drawing",
  "cost": 45.00,
  "participant_limit": 10,
  "available_spots": 3,
  "start_datetime": "2025-01-20T14:00:00Z",
  "worker": {
    "id": 1,
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@facility.com"
  },
  "tags": ["art", "creative"],
  "created_at": "2025-01-05T10:00:00Z"
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 404 Not Found: Activity not found

### 2.4 Enrollment Endpoints

#### List Child's Enrollments
- **Method:** GET
- **Path:** `/api/children/:childId/enrollments`
- **Description:** Get all activities a specific child is enrolled in
- **Authentication:** Required (Parent role)
- **Success Response (200 OK):**
```json
{
  "enrollments": [
    {
      "child_id": 1,
      "activity_id": 1,
      "enrolled_at": "2025-01-10T10:00:00Z",
      "can_withdraw": true,
      "activity": {
        "id": 1,
        "name": "Art Class",
        "description": "Creative painting and drawing",
        "cost": 45.00,
        "start_datetime": "2025-01-20T14:00:00Z",
        "worker": {
          "first_name": "Jane",
          "last_name": "Doe"
        }
      }
    }
  ]
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: Child does not belong to current parent
  - 404 Not Found: Child not found

#### Create Enrollment
- **Method:** POST
- **Path:** `/api/enrollments`
- **Description:** Enroll a child in an activity
- **Authentication:** Required (Parent role) 
- **Request Body:**
```json
{
  "child_id": 1,
  "activity_id": 1
}
```
- **Success Response (201 Created):**
```json
{
  "child_id": 1,
  "activity_id": 1,
  "enrolled_at": "2025-01-10T10:00:00Z",
  "activity": {
    "name": "Art Class",
    "start_datetime": "2025-01-20T14:00:00Z",
    "cost": 45.00
  },
  "child": {
    "first_name": "Alice",
    "last_name": "Smith"
  }
}
```
- **Error Responses:**
  - 400 Bad Request: Activity is full, or child already enrolled
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: Child does not belong to current parent
  - 404 Not Found: Child or activity not found

#### Delete Enrollment
- **Method:** DELETE
- **Path:** `/api/enrollments/:childId/:activityId`
- **Description:** Withdraw child from activity (only if >= 24 hours before start)
- **Authentication:** Required (Parent role)
- **Success Response (200 OK):**
```json
{
  "message": "Child successfully withdrawn from activity"
}
```
- **Error Responses:**
  - 400 Bad Request: Cannot withdraw less than 24 hours before activity start
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: Child does not belong to current parent
  - 404 Not Found: Enrollment not found

### 2.5 Report Endpoints

#### Generate Weekly Cost Report
- **Method:** GET
- **Path:** `/api/reports/costs`
- **Description:** Generate Excel report of activity costs for current week
- **Authentication:** Required (Parent role)
- **Query Parameters:**
  - `week` (ISO date, optional): Week start date (Monday), defaults to current week
- **Success Response (200 OK):**
  - Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - Response Body: Binary Excel file
  - Filename: `activity-costs-week-{date}.xlsx`
- **Excel Structure:**
  - Columns: Child First Name, Child Last Name, Activity Name, Activity Date, Activity Time, Cost
  - Last row: "Total" with sum of all costs
- **Error Responses:**
  - 400 Bad Request: Invalid week parameter
  - 401 Unauthorized: Invalid or expired token

### 2.6 Admin - Worker Endpoints

#### List Workers
- **Method:** GET
- **Path:** `/api/admin/workers`
- **Description:** Get all workers/instructors
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "workers": [
    {
      "id": 1,
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane.doe@facility.com",
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin

#### Get Worker by ID
- **Method:** GET
- **Path:** `/api/admin/workers/:id`
- **Description:** Get specific worker details
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "id": 1,
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@facility.com",
  "created_at": "2025-01-01T10:00:00Z"
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Worker not found

#### Create Worker
- **Method:** POST
- **Path:** `/api/admin/workers`
- **Description:** Add a new worker/instructor
- **Authentication:** Required (Admin role)
- **Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@facility.com"
}
```
- **Success Response (201 Created):**
```json
{
  "id": 1,
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@facility.com",
  "created_at": "2025-01-01T10:00:00Z"
}
```
- **Error Responses:**
  - 400 Bad Request: Missing required fields or invalid email format
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 409 Conflict: Email already exists

#### Update Worker
- **Method:** PATCH
- **Path:** `/api/admin/workers/:id`
- **Description:** Update worker information
- **Authentication:** Required (Admin role)
- **Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@facility.com"
}
```
- **Success Response (200 OK):**
```json
{
  "id": 1,
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@facility.com",
  "created_at": "2025-01-01T10:00:00Z"
}
```
- **Error Responses:**
  - 400 Bad Request: Invalid data format
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Worker not found
  - 409 Conflict: Email already exists

#### Delete Worker
- **Method:** DELETE
- **Path:** `/api/admin/workers/:id`
- **Description:** Delete a worker (only if not assigned to any activities)
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "message": "Worker deleted successfully"
}
```
- **Error Responses:**
  - 400 Bad Request: Worker is assigned to existing activities
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Worker not found

### 2.7 Admin - Activity Endpoints

#### Create Activity
- **Method:** POST
- **Path:** `/api/admin/activities`
- **Description:** Create a new activity
- **Authentication:** Required (Admin role)
- **Request Body:**
```json
{
  "name": "Art Class",
  "description": "Creative painting and drawing",
  "cost": 45.00,
  "participant_limit": 10,
  "start_datetime": "2025-01-20T14:00:00Z",
  "worker_id": 1,
  "tags": ["art", "creative"]
}
```
- **Success Response (201 Created):**
```json
{
  "id": 1,
  "name": "Art Class",
  "description": "Creative painting and drawing",
  "cost": 45.00,
  "participant_limit": 10,
  "start_datetime": "2025-01-20T14:00:00Z",
  "worker_id": 1,
  "facility_id": 1,
  "created_at": "2025-01-05T10:00:00Z"
}
```
- **Error Responses:**
  - 400 Bad Request: Missing required fields, invalid data format, or start_datetime in the past
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Worker not found

#### Update Activity
- **Method:** PATCH
- **Path:** `/api/admin/activities/:id`
- **Description:** Update activity details (triggers notification to enrolled parents)
- **Authentication:** Required (Admin role)
- **Request Body:**
```json
{
  "name": "Advanced Art Class",
  "description": "Creative painting and drawing for advanced students",
  "cost": 50.00,
  "start_datetime": "2025-01-20T15:00:00Z",
  "worker_id": 2,
  "tags": ["art", "creative", "advanced"]
}
```
- **Success Response (200 OK):**
```json
{
  "id": 1,
  "name": "Advanced Art Class",
  "description": "Creative painting and drawing for advanced students",
  "cost": 50.00,
  "participant_limit": 10,
  "start_datetime": "2025-01-20T15:00:00Z",
  "worker_id": 2,
  "facility_id": 1,
  "created_at": "2025-01-05T10:00:00Z",
  "notifications_sent": 7
}
```
- **Error Responses:**
  - 400 Bad Request: Invalid data format
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Activity or worker not found

#### Delete Activity
- **Method:** DELETE
- **Path:** `/api/admin/activities/:id`
- **Description:** Delete an activity (triggers notification to enrolled parents)
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "message": "Activity deleted successfully",
  "notifications_sent": 7
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Activity not found

### 2.8 Admin - Parent Management Endpoints

#### List Parents
- **Method:** GET
- **Path:** `/api/admin/parents`
- **Description:** Get all registered parent accounts
- **Authentication:** Required (Admin role)
- **Query Parameters:**
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 20, max: 100): Items per page
  - `search` (string, optional): Search by email, first name, or last name
- **Success Response (200 OK):**
```json
{
  "parents": [
    {
      "id": "uuid-string",
      "email": "parent@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "children_count": 2,
      "created_at": "2025-01-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin

#### Get Parent by ID
- **Method:** GET
- **Path:** `/api/admin/parents/:id`
- **Description:** Get detailed information about a specific parent
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "id": "uuid-string",
  "email": "parent@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "created_at": "2025-01-10T10:00:00Z",
  "children": [
    {
      "id": 1,
      "first_name": "Alice",
      "last_name": "Smith",
      "birth_date": "2020-05-15",
      "enrollments_count": 3
    }
  ]
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Parent not found

#### Delete Parent
- **Method:** DELETE
- **Path:** `/api/admin/parents/:id`
- **Description:** Delete parent account and all associated data (children, enrollments)
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "message": "Parent account and all associated data deleted successfully",
  "deleted_children": 2,
  "deleted_enrollments": 5
}
```
- **Error Responses:**
  - 400 Bad Request: Cannot delete admin account
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin
  - 404 Not Found: Parent not found

### 2.9 Admin - Tag Management Endpoints

#### List Available Tags
- **Method:** GET
- **Path:** `/api/admin/tags`
- **Description:** Get predefined list of available activity tags
- **Authentication:** Required (Admin role)
- **Success Response (200 OK):**
```json
{
  "tags": [
    "zajęcia kreatywne",
    "sport",
    "muzyka",
    "taniec",
    "nauka",
    "język obcy",
    "na świezym powietrzu",
    "w pomieszczeniu",
    "indywidualne"
  ]
}
```
- **Error Responses:**
  - 401 Unauthorized: Invalid or expired token
  - 403 Forbidden: User is not an admin

## 3. Authentication and Authorization

### Authentication Mechanism
The API uses **JWT (JSON Web Token)** based authentication provided by Supabase Auth. All authenticated endpoints require a valid JWT token in the Authorization header.

**Header Format:**
```
Authorization: Bearer <jwt_token>
```

### Token Management
- **Access Token Expiry:** Configured in Supabase (typically 1 hour)
- **Refresh Token:** Long-lived token to obtain new access tokens
- **Token Refresh:** Use Supabase SDK to refresh tokens when access token expires

### Authorization Levels

#### Public Endpoints
- POST `/api/auth/register`
- POST `/api/auth/login`

#### Parent-Only Endpoints
- All `/api/children/*` endpoints
- All `/api/activities/*` endpoints (read-only)
- All `/api/enrollments/*` endpoints
- GET `/api/reports/costs`
- GET `/api/profile`
- POST `/api/profile`
- PATCH `/api/profile`
- GET `/api/auth/onboarding-status`

#### Admin-Only Endpoints
- All `/api/admin/*` endpoints

### Implementation Details

1. **Middleware Authentication:**
   - Extract JWT from Authorization header
   - Validate token using Supabase Auth SDK
   - Extract user ID and role from token payload
   - Attach user context to request object

2. **Role-Based Access Control:**
   - Check user role from JWT payload or profiles table
   - Return 403 Forbidden if user lacks required role
   - Admin role has full access to all endpoints

3. **Row-Level Security (RLS):**
   - Enforced at database level using PostgreSQL RLS policies
   - Parents can only access their own children and enrollments
   - Admins bypass RLS policies for full data access

4. **Predefined Admin Account:**
   - Admin account is pre-seeded in database
   - Cannot be created through public registration endpoint
   - Must be managed directly in database or through secure admin setup process

## 4. Validation and Business Logic

### Input Validation

All request bodies are validated using **Zod schemas** at the API layer before processing.

#### User Registration Validation
- `email`: Required, valid email format, unique in database
- `password`: Required, minimum 8 characters, recommended strength checks

#### Child Profile Validation
- `first_name`: Required, string, 1-100 characters
- `last_name`: Required, string, 1-100 characters
- `birth_date`: Required, valid date, not in the future
- `description`: Optional, string, maximum 50 0 characters

#### Worker Validation
- `first_name`: Required, string, 1-100 characters
- `last_name`: Required, string, 1-100 characters
- `email`: Required, valid email format, unique in database

#### Activity Validation
- `name`: Required, string, 1-200 characters
- `description`: Optional, string, maximum 1000 characters
- `cost`: Required, decimal (10,2), positive value
- `participant_limit`: Required, integer, positive value, minimum 1
- `start_datetime`: Required, valid ISO 8601 datetime, must be in the future
- `worker_id`: Required, integer, must reference existing worker
- `tags`: Optional, array of strings, each must be from predefined tag list

#### Enrollment Validation
- `child_id`: Required, integer, must reference existing child belonging to current parent
- `activity_id`: Required, integer, must reference existing activity
- Composite uniqueness: (child_id, activity_id) must be unique

### Business Logic Rules

#### 1. Onboarding Enforcement (US-003)
- **Rule:** New parents must add at least one child before accessing other features
- **Implementation:** 
  - Check children count on protected parent endpoints
  - Redirect to child creation flow

#### 2. Enrollment Capacity Check (US-006)
- **Rule:** Cannot enroll if activity has reached participant limit
- **Implementation:**
  - Query enrollment count for activity
  - Compare with `participant_limit` 
  - Return 400 Bad Request if full: "Activity has no available spots"

#### 3. Duplicate Enrollment Prevention
- **Rule:** Child cannot be enrolled in the same activity multiple times
- **Implementation:**
  - Check for existing enrollment with same (child_id, activity_id)
  - Return 400 Bad Request if exists: "Child is already enrolled in this activity"

#### 4. 24-Hour Withdrawal Rule (US-007)
- **Rule:** Can only withdraw from activity at least 24 hours before start time
- **Implementation:**
  - Calculate time difference: `activity.start_datetime - current_time`
  - If difference < 24 hours, return 400 Bad Request: "Cannot withdraw less than 24 hours before activity start"
  - If >= 24 hours, proceed with deletion

#### 5. Activity Modification Notifications (US-011)
- **Rule:** Email notifications sent to parents when activity is edited or deleted
- **Implementation (MVP - Mocked):**
  - Query enrollments for activity to get list of enrolled children
  - Get parent email addresses from children's parent_ids
  - Log notification to console: `[MOCK EMAIL] To: parent@example.com, Subject: Activity "Art Class" has been updated`
  - Return count of notifications in response

#### 6. Parent Account Deletion Cascade (US-012)
- **Rule:** Deleting parent account removes all children and enrollments
- **Implementation:**
  - Rely on database CASCADE constraints
  - Track counts before deletion for response
  - Return summary of deleted records

#### 7. Weekly Cost Report Generation (US-008)
- **Rule:** Report covers Monday to Sunday of specified or current week
- **Implementation:**
  - Determine week start (Monday) and end (Sunday) from `week` parameter or current date
  - Query enrollments for current parent's children within date range
  - Join with activities to get cost and datetime
  - Generate Excel with columns: Child First Name, Child Last Name, Activity Name, Activity Date, Activity Time, Cost
  - Calculate sum of all costs and add as final row
  - Return Excel file with proper MIME type and filename

#### 8. Timezone Handling
- **Rule:** All dates stored in UTC, displayed in user's local timezone
- **Implementation:**
  - Store all timestamps in database as TIMESTAMPTZ (UTC)
  - Accept datetime input in ISO 8601 format with timezone
  - Return datetime in ISO 8601 UTC format
  - Client-side converts to local timezone for display

#### 9. Activity Tags Management
- **Rule:** Tags must be from predefined closed list
- **Implementation:**
  - Maintain predefined tag list in application configuration
  - Validate each tag in request against allowed list
  - Return 400 Bad Request if invalid tag provided

#### 10. Future Activity Validation
- **Rule:** Activities can only be created for future dates
- **Implementation:**
  - Validate `start_datetime` is after current time
  - Return 400 Bad Request if in the past: "Activity start time must be in the future"

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context (optional)"
    }
  }
}
```

### Common Error Codes
- `AUTH_INVALID_CREDENTIALS`: Invalid email or password
- `AUTH_TOKEN_EXPIRED`: JWT token has expired
- `AUTH_UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Requested resource not found
- `CONFLICT`: Resource conflict (e.g., duplicate email)
- `BUSINESS_LOGIC_ERROR`: Business rule violation
- `INTERNAL_ERROR`: Server error

### Data Sanitization
- Email addresses normalized to lowercase before storage
