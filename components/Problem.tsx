import Calculator from "./Calculator";
import { Eyebrow, H2 } from "./ui";

export default function Problem() {
  return (
    <section className="sec sec--light">
      <div className="wrap split">
        <div className="reveal">
          <Eyebrow num="01">The problem</Eyebrow>
          <H2>You’re paying for GPU hours you never use.</H2>
          <p className="lead dark">Serving an open model yourself means renting a GPU by the hour, all day, whether requests arrive or not. Meanwhile capable cards sit idle in PCs around the world.</p>
          <ul className="pains">
            <li>Paying by the hour for a GPU that waits for requests</li>
            <li>Writing retry and failover logic for when a machine drops</li>
            <li>Worrying who else can see your prompts on shared hardware</li>
          </ul>
        </div>
        <Calculator />
      </div>
    </section>
  );
}
