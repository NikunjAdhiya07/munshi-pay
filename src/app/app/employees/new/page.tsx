import { Flash, PageHeader } from "../../../../components/ui";
import { createEmployee } from "../../../../server/actions";
import { requireView } from "../../../../server/auth";
import { nextCodeFor } from "../../../../server/employees";
import { readStore } from "../../../../server/store";

type Query = {
  error?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  joinDate?: string;
  gender?: string;
  salaryBase?: string;
  department?: string;
  designation?: string;
  mobile?: string;
  email?: string;
  pfDeduct?: string;
  esiDeduct?: string;
};

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const session = await requireView("employees", "add");
  const query = await searchParams;
  const store = readStore();
  const listOf = (type: "department" | "designation") =>
    store.misc.filter(
      (item) => item.companyId === session.companyId && item.type === type,
    );
  const departments = listOf("department");
  const designations = listOf("designation");
  // After a refused save the form shows what the person typed. A first visit
  // starts with the reference defaults: male, PF on, and ESI on.
  const typed = query.error !== undefined;
  const checked = (value: string | undefined) => !typed || value === "1";

  return (
    <>
      <PageHeader
        title="Add employee"
        lede="Name and join date are required. The code is assigned for you. Salary is added on the next screen."
      />
      <Flash error={query.error} />
      <form className="panel form-measure" action={createEmployee}>
        <label>
          <span>Employee code</span>
          <input
            value={nextCodeFor(store, session.companyId)}
            readOnly
            aria-describedby="code-help"
          />
        </label>
        <p id="code-help" className="help">
          The next code in this company. It is assigned when you save.
        </p>
        <label>
          <span>First name</span>
          <input
            name="firstName"
            defaultValue={query.firstName ?? ""}
            maxLength={60}
            required
          />
        </label>
        <label>
          <span>Middle name</span>
          <input
            name="middleName"
            defaultValue={query.middleName ?? ""}
            maxLength={60}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            name="lastName"
            defaultValue={query.lastName ?? ""}
            maxLength={60}
          />
        </label>
        <label>
          <span>Gender</span>
          <select name="gender" defaultValue={query.gender ?? "male"}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>
          <span>Join date</span>
          <input
            name="joinDate"
            type="date"
            defaultValue={query.joinDate ?? ""}
            required
          />
        </label>
        <label>
          <span>Salary base</span>
          <select name="salaryBase" defaultValue={query.salaryBase ?? "salary"}>
            <option value="salary">Salary</option>
            <option value="per-day">Per day</option>
          </select>
        </label>
        <label>
          <span>Department</span>
          <select name="department" defaultValue={query.department ?? ""}>
            <option value="">Select</option>
            {departments.map((item) => (
              <option key={item.id}>{item.description}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Designation</span>
          <select name="designation" defaultValue={query.designation ?? ""}>
            <option value="">Select</option>
            {designations.map((item) => (
              <option key={item.id}>{item.description}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Mobile</span>
          <input name="mobile" defaultValue={query.mobile ?? ""} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" defaultValue={query.email ?? ""} />
        </label>
        <label className="check">
          <input
            name="pfDeduct"
            type="checkbox"
            defaultChecked={checked(query.pfDeduct)}
          />
          PF deduction
        </label>
        <label className="check">
          <input
            name="esiDeduct"
            type="checkbox"
            defaultChecked={checked(query.esiDeduct)}
          />
          ESI deduction
        </label>
        <p className="help">
          PF and ESI are deducted only when the company has the percent set
          under Company. Untick a box for someone who is not covered.
        </p>
        <button type="submit">Create employee</button>
      </form>
    </>
  );
}
