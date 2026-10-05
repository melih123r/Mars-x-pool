import com.marsx.mobileminer.PoolShareObserver;
import java.nio.charset.StandardCharsets;
public final class PoolShareObserverTest {
    static void feed(PoolShareObserver p, boolean outbound, String json) {
        byte[] bytes=(json+"\n").getBytes(StandardCharsets.UTF_8);p.bytes(outbound,bytes,bytes.length);
    }
    public static void main(String[] args) {
        final int[] count={0};PoolShareObserver p=new PoolShareObserver("wallet.phone",()->count[0]++);
        feed(p,false,"{\"id\":9,\"result\":true}");
        feed(p,true,"{\"id\":1,\"method\":\"mining.submit\",\"params\":[\"wallet.phone\"]}");
        feed(p,false,"{\"id\":1,\"result\":true}");
        if(count[0]!=0)throw new AssertionError("unauthorized share must not count");
        feed(p,true,"{\"id\":2,\"method\":\"mining.authorize\",\"params\":[\"wallet.phone\",\"X\"]}");
        feed(p,false,"{\"id\":2,\"result\":true,\"error\":null}");
        feed(p,true,"{\"id\":3,\"method\":\"mining.submit\",\"params\":[\"other.phone\"]}");
        feed(p,false,"{\"id\":3,\"result\":true}");
        feed(p,true,"{\"id\":4,\"method\":\"mining.submit\",\"params\":[\"wallet.phone\"]}");
        feed(p,false,"{\"id\":4,\"result\":true,\"error\":null}");
        feed(p,false,"{\"id\":4,\"result\":true,\"error\":null}");
        feed(p,true,"{\"id\":5,\"method\":\"mining.submit\",\"params\":[\"wallet.phone\"]}");
        feed(p,false,"{\"id\":5,\"result\":false,\"error\":[23,\"low difficulty\",null]}");
        if(count[0]!=1)throw new AssertionError("wrong-wallet, duplicate or rejected replies must not count");
        System.out.println("Share observer requires authorization and a matching unique accepted response.");
    }
}
