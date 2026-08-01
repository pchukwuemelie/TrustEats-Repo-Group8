import { useState } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../constants";
import { useAuth } from "../contexts/AuthContext";
import { BackButton } from "../components/ui/BackButton";
import { useMediaQuery } from "../hooks/useMediaQuery";
import logo from "../assets/logo.png";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");

    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("All fields are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!termsAgreed) {
      setError("You must agree to the Terms & Conditions.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName,
        name: form.fullName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: "consumer" as const,
        termsAccepted: termsAgreed,
      };

      // register now returns the auth result; if the backend logs the user in
      // and returns a token/manufacturer, go to the dashboard. Otherwise send
      // the user to the Verify Email flow (OTP) where they must enter the code.
      const result = await register(payload);

      // If the backend provided a token or user object, assume user is signed in
      const didAutoLogin = !!(result && (result.token || result.manufacturer));

      if (didAutoLogin) {
        navigate(ROUTES.DASHBOARD);
      } else {
        // If the backend returned an otp in the register response (dev-only), pass it
        // to the Verify Email page so inputs can be pre-filled for testing.
        // register now returns { manufacturer?, token?, otp? } in dev.
        const otp = (result as any)?.otp;
        navigate(ROUTES.VERIFY_EMAIL, { state: { email: form.email, otp } });
      }
    } catch (err) {
      setError(
        (err as { message?: string })?.message ??
          "Registration failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.phone}>
      <div style={styles.backWrap}>
        <BackButton />
      </div>
      <img src="/assets/Deco.svg" alt="" style={styles.archImg} />

      <div style={{ ...styles.logoWrap, ...(isDesktop ? { marginTop: "24px" } : {}) }}>
        <img
          src={logo}
          alt="TrustEats"
          className="h-8 w-auto"
        />
      </div>

      <div style={styles.content}>
        <h1 style={styles.heading}>Create your Account</h1>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.form}>
          <Field label="Role">
            <select
              defaultValue="consumer"
              onChange={(e) => {
                if (e.target.value === "manufacturer") {
                  navigate(ROUTES.MANUFACTURER_SIGNUP, {
                    state: { fullName: form.fullName, email: form.email },
                  });
                }
              }}
              style={{ ...styles.input, height: "44px" }}
              disabled={isSubmitting}
            >
              <option value="consumer">I'm a Consumer</option>
              <option value="manufacturer">I'm a Manufacturer</option>
            </select>
          </Field>

          <Field label="Full name">
            <input
              name="fullName"
              type="text"
              placeholder="Input details"
              value={form.fullName}
              onChange={handleChange}
              style={styles.input}
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Email">
            <input
              name="email"
              type="email"
              placeholder="Input details"
              value={form.email}
              onChange={handleChange}
              style={styles.input}
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Password">
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              style={styles.input}
              disabled={isSubmitting}
            />
          </Field>
          <p style={styles.hint}>Not less than 8 characters</p>

          <Field label="Confirm Password">
            <input
              name="confirmPassword"
              type="password"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={handleChange}
              style={styles.input}
              disabled={isSubmitting}
            />
          </Field>

          <label style={styles.termsLabel}>
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              style={styles.checkbox}
              disabled={isSubmitting}
            />
            <span style={{ marginLeft: 8 }}>
              I agree to the{" "}
              <a
                href="#"
                style={{ color: "#3c7443", textDecoration: "underline" }}
              >
                Terms & Conditions
              </a>
            </span>
          </label>

          <button
            style={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  phone: {
    minHeight: "100vh",
    background: "#EEF2F5",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  backWrap: {
    position: "absolute",
    top: "12px",
    left: "12px",
    zIndex: 3,
  },
  archImg: {
    width: "100%",
    height: "auto",
    maxHeight: "180px",
    objectFit: "cover",
    display: "block",
    marginTop: "-40px",
    flexShrink: 0,
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "-10px",
    zIndex: 2,
    position: "relative",
  },
  content: {
    padding: "16px 20px 48px",
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#292d32",
    textAlign: "center",
    marginBottom: "24px",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    color: "#DC2626",
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    marginBottom: "16px",
    fontWeight: 500,
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "18px",
  },
  label: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#292d32",
    marginBottom: "6px",
  },
  input: {
    height: "52px",
    background: "#fff",
    border: "1px solid #9A9A9A",
    borderRadius: "8px",
    padding: "0 16px",
    fontSize: "15px",
    fontFamily: "'Inter', sans-serif",
    color: "#292d32",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  hint: {
    fontSize: "13px",
    color: "#444",
    marginTop: "-12px",
    marginBottom: "18px",
  },
  termsLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#292d32",
    cursor: "pointer",
    marginBottom: "16px",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    accentColor: "#3c7443",
  },
  btnPrimary: {
    width: "100%",
    height: "52px",
    background: "#3c7443",
    color: "#fff",
    fontSize: "17px",
    fontWeight: 700,
    fontFamily: "'Inter', sans-serif",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
