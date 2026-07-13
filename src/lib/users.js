import getBigQuery from './bigquery';

const DATASET = 'onda_booking_db';

/**
 * Auto-provisioning + sinkronisasi: upsert profil Lark ke tabel users
 * setiap kali login (MERGE = DML, langsung bisa dibaca/di-update).
 */
export async function upsertUser(profile) {
  const bigquery = getBigQuery();

  const mergeQuery = `
    MERGE \`${DATASET}.users\` t
    USING (SELECT @lark_user_id AS lark_user_id) s
    ON t.lark_user_id = s.lark_user_id
    WHEN MATCHED THEN UPDATE SET
      union_id = @union_id,
      name = @name,
      email = @email,
      employee_no = @employee_no,
      job_title = @job_title,
      department_ids = @department_ids,
      department_names = @department_names,
      leader_user_id = @leader_user_id,
      leader_name = @leader_name,
      role = @role,
      is_supervisor = @is_supervisor,
      avatar_url = @avatar_url,
      updated_at = CURRENT_TIMESTAMP(),
      last_login_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT
      (lark_user_id, union_id, name, email, employee_no, job_title,
       department_ids, department_names, leader_user_id, leader_name,
       role, is_supervisor, avatar_url, created_at, updated_at, last_login_at)
    VALUES
      (@lark_user_id, @union_id, @name, @email, @employee_no, @job_title,
       @department_ids, @department_names, @leader_user_id, @leader_name,
       @role, @is_supervisor, @avatar_url,
       CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`;

  await bigquery.query({
    query: mergeQuery,
    params: {
      lark_user_id: profile.lark_user_id,
      union_id: profile.union_id || '',
      name: profile.name || '',
      email: profile.email || '',
      employee_no: profile.employee_no || '',
      job_title: profile.job_title || '',
      department_ids: JSON.stringify(profile.department_ids || []),
      department_names: (profile.department_names || []).join(', '),
      leader_user_id: profile.leader_user_id || '',
      leader_name: profile.leader_name || '',
      role: profile.role,
      is_supervisor: !!profile.is_supervisor,
      avatar_url: profile.avatar_url || '',
    },
  });
}

/** Ambil satu user tersinkron berdasarkan Lark user id (open_id). */
export async function getUserByLarkId(larkUserId) {
  const bigquery = getBigQuery();
  const [rows] = await bigquery.query({
    query: `SELECT * FROM \`${DATASET}.users\` WHERE lark_user_id = @id LIMIT 1`,
    params: { id: larkUserId },
  });
  return rows[0] || null;
}
